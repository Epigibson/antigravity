package service

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/nexus-dev/nexus/internal/domain"
	"github.com/nexus-dev/nexus/internal/port"
)

// Orchestrator is the central service that coordinates context switching.
// It reads the project configuration, resolves the enabled skills,
// executes them in priority order, and logs every action to the audit trail.
type Orchestrator struct {
	configReader  port.ConfigReader
	executors     map[string]port.SkillExecutor
	cliProfilers  map[string]port.CLIProfiler
	auditLogger   port.AuditLogger
	shellEmitter  port.ShellEmitter
}

// OrchestratorConfig holds the configuration for creating an Orchestrator.
type OrchestratorConfig struct {
	ConfigReader  port.ConfigReader
	Executors     []port.SkillExecutor
	CLIProfilers  []port.CLIProfiler
	AuditLogger   port.AuditLogger
	ShellEmitter  port.ShellEmitter
}

// SwitchResult holds the aggregated results of a context switch operation.
type SwitchResult struct {
	ProjectName   string               `json:"project_name"`
	Environment   string               `json:"environment"`
	SkillResults  []domain.SkillResult  `json:"skill_results"`
	ShellScript   string               `json:"shell_script"`
	TotalDuration time.Duration        `json:"total_duration_ms"`
	Success       bool                 `json:"success"`
}

// NewOrchestrator creates a new Orchestrator with the given dependencies.
func NewOrchestrator(cfg OrchestratorConfig) *Orchestrator {
	executors := make(map[string]port.SkillExecutor)
	for _, e := range cfg.Executors {
		executors[e.Name()] = e
	}

	profilers := make(map[string]port.CLIProfiler)
	for _, p := range cfg.CLIProfilers {
		profilers[p.ToolName()] = p
	}

	return &Orchestrator{
		configReader:  cfg.ConfigReader,
		executors:     executors,
		cliProfilers:  profilers,
		auditLogger:   cfg.AuditLogger,
		shellEmitter:  cfg.ShellEmitter,
	}
}

// Switch performs a full context switch to the specified project and environment.
// This is the main entry point for Local Mode (reads from YAML file).
func (o *Orchestrator) Switch(projectPath, envName string) (*SwitchResult, error) {
	// 1. Load project configuration
	project, err := o.configReader.ReadProject(projectPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read project config: %w", err)
	}

	if err := project.Validate(); err != nil {
		return nil, fmt.Errorf("invalid project config: %w", err)
	}

	return o.SwitchWithProject(project, envName)
}

// SwitchWithProject performs a full context switch with a pre-loaded project.
// This is used by Cloud Mode (project loaded from API) and Local Mode (via Switch).
// Having a single entry point ensures consistent behavior across both modes.
func (o *Orchestrator) SwitchWithProject(project *domain.Project, envName string) (*SwitchResult, error) {
	startTime := time.Now()

	// 1. Resolve the target environment
	env, err := project.GetEnvironment(envName)
	if err != nil {
		return nil, err
	}

	// 2. Log the switch initiation
	o.logAudit(domain.AuditActionSwitch, project.Name, envName, "",
		fmt.Sprintf("Starting context switch to %s/%s", project.Name, envName), true)

	// 3. Run PRE-switch hooks
	preResults := o.runHooks(project, env, envName, "pre")

	// 4. Get enabled skills sorted by priority
	skills := project.GetEnabledSkills()

	// 5. Execute each skill
	results := make([]domain.SkillResult, 0, len(skills)+len(preResults))
	results = append(results, preResults...)
	var shellLines []string

	// Header for shell script
	shellLines = append(shellLines, o.shellEmitter.EmitComment(
		fmt.Sprintf("Nexus Context Switch: %s → %s", project.Name, envName)))
	shellLines = append(shellLines, o.shellEmitter.EmitComment(
		fmt.Sprintf("Generated at: %s", time.Now().Format(time.RFC3339))))
	shellLines = append(shellLines, "")

	// Inject hybrid state context variables
	shellLines = append(shellLines, o.shellEmitter.EmitSetEnv("NEXUS_ACTIVE_WORKSPACE", project.Name))
	shellLines = append(shellLines, o.shellEmitter.EmitSetEnv("NEXUS_ACTIVE_ENV", envName))
	shellLines = append(shellLines, "")

	for _, skill := range skills {
		result := o.executeSkill(project, env, &skill)
		results = append(results, *result)

		// Collect shell commands from env injection
		if skill.Category == domain.SkillCategoryContext && result.IsSuccess() {
			for key, value := range env.EnvVars {
				shellLines = append(shellLines, o.shellEmitter.EmitSetEnv(key, value))
			}
			shellLines = append(shellLines, "")
		}

		// Log the skill result to audit
		o.logAudit(domain.AuditAction("skill_"+string(skill.Category)), project.Name, envName,
			skill.Name, result.Message, result.IsSuccess())
	}

	// 6. Handle CLI profile switching
	cliResults := o.switchCLIProfiles(project, env, envName)
	results = append(results, cliResults...)

	// 7. Run POST-switch hooks
	postResults := o.runHooks(project, env, envName, "post")
	results = append(results, postResults...)

	// 8. Aggregate results
	allSuccess := true
	for _, r := range results {
		if r.Status == domain.SkillStatusFailed {
			allSuccess = false
			break
		}
	}

	totalDuration := time.Since(startTime)

	// 9. Final audit log
	o.logAudit(domain.AuditActionSwitch, project.Name, envName, "",
		fmt.Sprintf("Context switch completed in %dms (success=%v)", totalDuration.Milliseconds(), allSuccess),
		allSuccess)

	return &SwitchResult{
		ProjectName:   project.Name,
		Environment:   envName,
		SkillResults:  results,
		ShellScript:   strings.Join(shellLines, "\n"),
		TotalDuration: totalDuration,
		Success:       allSuccess,
	}, nil
}

// executeSkill runs a single skill and handles errors gracefully.
func (o *Orchestrator) executeSkill(project *domain.Project, env *domain.EnvironmentConfig, skill *domain.Skill) *domain.SkillResult {
	startTime := time.Now()

	executor, ok := o.executors[string(skill.Category)]
	if !ok {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusSkipped,
			Message:   fmt.Sprintf("No executor registered for category '%s'", skill.Category),
			Duration:  time.Since(startTime),
		}
	}

	result, err := executor.Execute(project, env, skill)
	if err != nil {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusFailed,
			Message:   fmt.Sprintf("Execution failed: %v", err),
			Duration:  time.Since(startTime),
			Error:     err,
		}
	}

	result.Duration = time.Since(startTime)
	return result
}

// switchCLIProfiles handles the core value proposition: switching all CLI tools.
func (o *Orchestrator) switchCLIProfiles(project *domain.Project, env *domain.EnvironmentConfig, envName string) []domain.SkillResult {
	var results []domain.SkillResult

	for _, profile := range env.CLIProfiles {
		startTime := time.Now()

		profiler, ok := o.cliProfilers[profile.Tool]
		if !ok {
			results = append(results, domain.SkillResult{
				SkillName: fmt.Sprintf("cli:%s", profile.Tool),
				Status:    domain.SkillStatusSkipped,
				Message:   fmt.Sprintf("No profiler registered for tool '%s'", profile.Tool),
				Duration:  time.Since(startTime),
			})
			continue
		}

		// Check if tool is installed
		if !profiler.IsInstalled() {
			results = append(results, domain.SkillResult{
				SkillName: fmt.Sprintf("cli:%s", profile.Tool),
				Status:    domain.SkillStatusSkipped,
				Message:   fmt.Sprintf("Tool '%s' is not installed, skipping", profile.Tool),
				Duration:  time.Since(startTime),
			})
			continue
		}

		// Get current profile for comparison
		currentProfile, _ := profiler.CurrentProfile()

		// Switch to the target profile
		if err := profiler.Switch(profile); err != nil {
			results = append(results, domain.SkillResult{
				SkillName: fmt.Sprintf("cli:%s", profile.Tool),
				Status:    domain.SkillStatusFailed,
				Message:   fmt.Sprintf("Failed to switch %s to '%s': %v", profile.Tool, profile.Account, err),
				Duration:  time.Since(startTime),
				Error:     err,
			})

			o.logAudit(domain.AuditActionCLISwitch, project.Name, envName, profile.Tool,
				fmt.Sprintf("Failed to switch %s from '%s' → '%s'", profile.Tool, currentProfile, profile.Account), false)
			continue
		}

		results = append(results, domain.SkillResult{
			SkillName: fmt.Sprintf("cli:%s", profile.Tool),
			Status:    domain.SkillStatusSuccess,
			Message:   fmt.Sprintf("Switched %s: '%s' → '%s'", profile.Tool, currentProfile, profile.Account),
			Duration:  time.Since(startTime),
			Actions:   []string{fmt.Sprintf("%s account changed to %s", profile.Tool, profile.Account)},
		})

		o.logAudit(domain.AuditActionCLISwitch, project.Name, envName, profile.Tool,
			fmt.Sprintf("Switched %s: '%s' → '%s'", profile.Tool, currentProfile, profile.Account), true)
	}

	return results
}

// logAudit is a helper that safely logs to the audit trail.
func (o *Orchestrator) logAudit(action domain.AuditAction, project, env, skill, message string, success bool) {
	if o.auditLogger == nil {
		return
	}
	entry := domain.NewAuditEntry(action, project, env, skill, message)
	entry.Success = success
	_ = o.auditLogger.Log(entry) // Best effort — never fail the main flow for audit
}

// ListProjects returns all discovered project configurations.
func (o *Orchestrator) ListProjects() ([]domain.Project, error) {
	return o.configReader.ListProjects()
}

// GetAvailableProfilers returns the names of all registered CLI profilers.
func (o *Orchestrator) GetAvailableProfilers() []string {
	names := make([]string, 0, len(o.cliProfilers))
	for name := range o.cliProfilers {
		names = append(names, name)
	}
	return names
}

// GetInstalledTools checks which registered CLI tools are actually installed.
func (o *Orchestrator) GetInstalledTools() map[string]bool {
	installed := make(map[string]bool)
	for name, profiler := range o.cliProfilers {
		installed[name] = profiler.IsInstalled()
	}
	return installed
}

// runHooks executes script hooks for a given phase ("pre" or "post").
func (o *Orchestrator) runHooks(project *domain.Project, env *domain.EnvironmentConfig, envName, phase string) []domain.SkillResult {
	var results []domain.SkillResult

	for _, hook := range env.Hooks {
		if hook.Phase != phase {
			continue
		}

		startTime := time.Now()
		skillName := fmt.Sprintf("hook:%s:%s", phase, hook.Name)

		// Set timeout (default 30s)
		timeout := time.Duration(hook.Timeout) * time.Second
		if timeout <= 0 {
			timeout = 30 * time.Second
		}

		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		cmd := exec.CommandContext(ctx, "sh", "-c", hook.Command)

		// Run from project root if available
		if project.RootPath != "" {
			cmd.Dir = project.RootPath
		}

		output, err := cmd.CombinedOutput()
		cancel()

		if err != nil {
			results = append(results, domain.SkillResult{
				SkillName: skillName,
				Status:    domain.SkillStatusFailed,
				Message:   fmt.Sprintf("Hook '%s' failed: %v (output: %s)", hook.Name, err, strings.TrimSpace(string(output))),
				Duration:  time.Since(startTime),
				Error:     err,
			})
			o.logAudit(domain.AuditAction("script_"+phase), project.Name, envName, hook.Name,
				fmt.Sprintf("Hook '%s' failed: %v", hook.Name, err), false)
			continue
		}

		results = append(results, domain.SkillResult{
			SkillName: skillName,
			Status:    domain.SkillStatusSuccess,
			Message:   fmt.Sprintf("Hook '%s' completed successfully", hook.Name),
			Duration:  time.Since(startTime),
			Actions:   []string{strings.TrimSpace(string(output))},
		})
		o.logAudit(domain.AuditAction("script_"+phase), project.Name, envName, hook.Name,
			fmt.Sprintf("Hook '%s' completed in %dms", hook.Name, time.Since(startTime).Milliseconds()), true)
	}

	return results
}
