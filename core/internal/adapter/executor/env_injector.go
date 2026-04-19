package executor

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/nexus-dev/nexus/internal/domain"
)

// EnvInjector handles injecting environment variables into the current session.
// Implements port.SkillExecutor for the "context-injection" skill category.
type EnvInjector struct{}

func NewEnvInjector() *EnvInjector {
	return &EnvInjector{}
}

func (e *EnvInjector) Name() string {
	return string(domain.SkillCategoryContext)
}

func (e *EnvInjector) Execute(project *domain.Project, env *domain.EnvironmentConfig, skill *domain.Skill) (*domain.SkillResult, error) {
	startTime := time.Now()

	if len(env.EnvVars) == 0 {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusSkipped,
			Message:   "No environment variables defined",
			Duration:  time.Since(startTime),
		}, nil
	}

	actions := make([]string, 0, len(env.EnvVars))
	for key := range env.EnvVars {
		actions = append(actions, fmt.Sprintf("Env: %s", key))
	}

	return &domain.SkillResult{
		SkillName: skill.Name,
		Status:    domain.SkillStatusSuccess,
		Message:   fmt.Sprintf("Prepared %d environment variables for injection", len(env.EnvVars)),
		Duration:  time.Since(startTime),
		Actions:   actions,
	}, nil
}

func (e *EnvInjector) Rollback(project *domain.Project, env *domain.EnvironmentConfig) error {
	return nil // Env vars are session-scoped, no rollback needed
}

// ----- Shell Emitters -----

// PowerShellEmitter generates PowerShell commands for env var management.
type PowerShellEmitter struct{}

func (p *PowerShellEmitter) ShellName() string { return "powershell" }

func (p *PowerShellEmitter) EmitSetEnv(key, value string) string {
	// Escape single quotes in value
	escaped := strings.ReplaceAll(value, "'", "''")
	return fmt.Sprintf("$env:%s = '%s'", key, escaped)
}

func (p *PowerShellEmitter) EmitUnsetEnv(key string) string {
	return fmt.Sprintf("Remove-Item Env:\\%s -ErrorAction SilentlyContinue", key)
}

func (p *PowerShellEmitter) EmitComment(text string) string {
	return fmt.Sprintf("# %s", text)
}

// BashEmitter generates Bash/Zsh commands for env var management.
type BashEmitter struct{}

func (b *BashEmitter) ShellName() string { return "bash" }

func (b *BashEmitter) EmitSetEnv(key, value string) string {
	// Escape special chars for bash
	escaped := strings.ReplaceAll(value, "'", "'\\''")
	return fmt.Sprintf("export %s='%s'", key, escaped)
}

func (b *BashEmitter) EmitUnsetEnv(key string) string {
	return fmt.Sprintf("unset %s", key)
}

func (b *BashEmitter) EmitComment(text string) string {
	return fmt.Sprintf("# %s", text)
}

// DetectShellEmitter returns the appropriate emitter for the current OS/shell.
func DetectShellEmitter() interface {
	ShellName() string
	EmitSetEnv(key, value string) string
	EmitUnsetEnv(key string) string
	EmitComment(text string) string
} {
	if runtime.GOOS == "windows" {
		return &PowerShellEmitter{}
	}
	return &BashEmitter{}
}

// ----- Git State Switcher -----

// GitSwitcher handles checking out the correct Git branch.
// Implements port.SkillExecutor for the "git-state" skill category.
type GitSwitcher struct{}

func NewGitSwitcher() *GitSwitcher {
	return &GitSwitcher{}
}

func (g *GitSwitcher) Name() string {
	return string(domain.SkillCategoryGit)
}

func (g *GitSwitcher) Execute(project *domain.Project, env *domain.EnvironmentConfig, skill *domain.Skill) (*domain.SkillResult, error) {
	startTime := time.Now()

	if env.Branch == "" {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusSkipped,
			Message:   "No branch specified for this environment",
			Duration:  time.Since(startTime),
		}, nil
	}

	// Get current branch
	currentBranch, err := getCurrentBranch(project.RootPath)
	if err != nil {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusFailed,
			Message:   fmt.Sprintf("Failed to get current branch: %v", err),
			Duration:  time.Since(startTime),
			Error:     err,
		}, nil
	}

	// If already on the right branch, skip
	if currentBranch == env.Branch {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusSuccess,
			Message:   fmt.Sprintf("Already on branch '%s'", env.Branch),
			Duration:  time.Since(startTime),
		}, nil
	}

	// Fetch first in case branch only exists in remote
	fetchCmd := exec.Command("git", "fetch")
	fetchCmd.Dir = project.RootPath
	_ = fetchCmd.Run()

	// Checkout target branch
	cmd := exec.Command("git", "checkout", env.Branch)
	cmd.Dir = project.RootPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusFailed,
			Message:   fmt.Sprintf("git checkout failed: %s", strings.TrimSpace(string(output))),
			Duration:  time.Since(startTime),
			Error:     err,
		}, nil
	}

	return &domain.SkillResult{
		SkillName: skill.Name,
		Status:    domain.SkillStatusSuccess,
		Message:   fmt.Sprintf("Switched branch: '%s' → '%s'", currentBranch, env.Branch),
		Duration:  time.Since(startTime),
		Actions:   []string{fmt.Sprintf("git checkout %s", env.Branch)},
	}, nil
}

func (g *GitSwitcher) Rollback(project *domain.Project, env *domain.EnvironmentConfig) error {
	return nil // Git state is managed by git itself
}

func getCurrentBranch(repoPath string) (string, error) {
	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	if repoPath != "" {
		cmd.Dir = repoPath
	}
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}
