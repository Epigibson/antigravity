package cli

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/nexus-dev/nexus/internal/adapter/audit"
	"github.com/nexus-dev/nexus/internal/adapter/config"
	"github.com/nexus-dev/nexus/internal/adapter/executor"
	"github.com/nexus-dev/nexus/internal/adapter/repository"
	"github.com/nexus-dev/nexus/internal/adapter/state"
	"github.com/nexus-dev/nexus/internal/domain"
	"github.com/nexus-dev/nexus/internal/port"
	"github.com/nexus-dev/nexus/internal/service"
	"github.com/spf13/cobra"
)

func newSwitchCmd() *cobra.Command {
	var envName string

	cmd := &cobra.Command{
		Use:   "switch <project-name>",
		Short: "🔄 Switch your entire development context to a project",
		Long: `Switch all CLI tools, environment variables, and Git state to match
the specified project and environment. This is the core command of Nexus.

If you are authenticated (run 'nexus login' first), the project
configuration is fetched from the cloud API. Otherwise, it reads from
a local nexus.yaml file.

Example:
  nexus switch my-saas-app --env production
  nexus switch client-dashboard --env staging
  nexus switch personal-blog`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if envName == "" {
				envName = "development"
			}

			fmt.Print(banner)

			// ── Try cloud mode first (if authenticated) ──
			client := repository.NewAPIClient(getAPIURL())
			if client.IsAuthenticated() && len(args) > 0 {
				projectSlug := args[0]
				fmt.Printf("  ☁️  Cloud mode — fetching project '%s'\n", projectSlug)

				project, err := client.GetProject(projectSlug)
				if err != nil {
					fmt.Printf("  ⚠️  Cloud fetch failed: %v\n", err)
					fmt.Println("  Falling back to local config...")
					return switchLocal(args, envName)
				}

				return switchFromAPI(project, envName)
			}

			// ── Local mode (YAML file) ──
			return switchLocal(args, envName)
		},
	}

	cmd.Flags().StringVarP(&envName, "env", "e", "development", "Target environment (development, staging, production)")

	return cmd
}

// switchFromAPI performs a switch using data fetched from the Nexus API.
func switchFromAPI(projectDTO *repository.ProjectDTO, envName string) error {
	startTime := time.Now()

	// Find the target environment
	var targetEnv *repository.EnvironmentDTO
	for _, env := range projectDTO.Environments {
		if env.Name == envName {
			targetEnv = &env
			break
		}
	}
	if targetEnv == nil {
		available := make([]string, 0, len(projectDTO.Environments))
		for _, e := range projectDTO.Environments {
			available = append(available, e.Name)
		}
		return fmt.Errorf("environment '%s' not found (available: %v)", envName, available)
	}

	fmt.Printf("  🚀 Switching context → \033[1;36m%s\033[0m / \033[1;33m%s\033[0m\n\n",
		projectDTO.Name, envName)

	// Build CLI profilers
	allProfilers := executor.AllProfilers()
	profilerMap := make(map[string]port.CLIProfiler)
	for _, p := range allProfilers {
		profilerMap[p.ToolName()] = p
	}

	results := make([]string, 0)
	hasErrors := false

	// ── Inject env vars FIRST (tokens needed by profilers) ──
	if len(targetEnv.EnvVars) > 0 {
		for key, value := range targetEnv.EnvVars {
			os.Setenv(key, value)
		}
	}

	// ── Switch CLI profiles ──
	for _, profile := range targetEnv.CLIProfiles {
		profiler, ok := profilerMap[profile.Tool]
		if !ok {
			results = append(results, fmt.Sprintf("  ⏭️  %s — no profiler registered", profile.Tool))
			continue
		}

		if !profiler.IsInstalled() {
			results = append(results, fmt.Sprintf("  ⏭️  %s — CLI not installed", profile.Tool))
			continue
		}

		domainProfile := domain.CLIProfile{
			Tool:    profile.Tool,
			Account: profile.Account,
			Org:     profile.Org,
			Region:  profile.Region,
			Extra:   profile.Extra,
		}

		err := profiler.Switch(domainProfile)
		if err != nil {
			results = append(results, fmt.Sprintf("  ❌ %s — %v", profile.Tool, err))
			hasErrors = true
		} else {
			results = append(results, fmt.Sprintf("  ✅ %s → %s", profile.Tool, profile.Account))
		}
	}

	// ── Apply environment variables ──
	shellEmitter := executor.DetectShellEmitter()
	var shellLines []string

	// Collect env vars from profilers (Stripe keys, etc.)
	profilerEnvVars := map[string]string{}
	for _, profile := range targetEnv.CLIProfiles {
		if profile.Extra != nil {
			switch profile.Tool {
			case "stripe":
				if v, ok := profile.Extra["secret_key"]; ok && v != "" {
					profilerEnvVars["STRIPE_SECRET_KEY"] = v
					profilerEnvVars["STRIPE_API_KEY"] = v
				}
				if v, ok := profile.Extra["publishable_key"]; ok && v != "" {
					profilerEnvVars["STRIPE_PUBLISHABLE_KEY"] = v
				}
				if profile.Account != "" {
					profilerEnvVars["STRIPE_ACCOUNT"] = profile.Account
				}
			case "supabase":
				if profile.Account != "" {
					profilerEnvVars["SUPABASE_PROJECT_REF"] = profile.Account
				}
				if v, ok := profile.Extra["token"]; ok && v != "" {
					profilerEnvVars["SUPABASE_ACCESS_TOKEN"] = v
				}
			case "aws":
				if profile.Account != "" {
					profilerEnvVars["AWS_PROFILE"] = profile.Account
				}
				if profile.Region != "" {
					profilerEnvVars["AWS_REGION"] = profile.Region
					profilerEnvVars["AWS_DEFAULT_REGION"] = profile.Region
				}
			}
		}
	}

	allEnvVars := make(map[string]string)
	for k, v := range targetEnv.EnvVars {
		allEnvVars[k] = v
	}
	for k, v := range profilerEnvVars {
		allEnvVars[k] = v
	}

	if len(allEnvVars) > 0 {
		shellLines = append(shellLines, shellEmitter.EmitComment(
			fmt.Sprintf("Nexus Context Switch: %s → %s", projectDTO.Name, envName)))
		shellLines = append(shellLines, shellEmitter.EmitComment(
			fmt.Sprintf("Generated at: %s", time.Now().Format(time.RFC3339))))
		shellLines = append(shellLines, "")

		// Inject hybrid state context variables
		shellLines = append(shellLines, shellEmitter.EmitSetEnv("NEXUS_ACTIVE_WORKSPACE", projectDTO.Name))
		shellLines = append(shellLines, shellEmitter.EmitSetEnv("NEXUS_ACTIVE_ENV", envName))
		shellLines = append(shellLines, "")

		for key, value := range allEnvVars {
			shellLines = append(shellLines, shellEmitter.EmitSetEnv(key, value))
		}
		results = append(results, fmt.Sprintf("  ✅ env vars — %d variables set", len(allEnvVars)))
	}

	// ── Git branch ──
	if targetEnv.GitBranch != "" {
		cwd, _ := os.Getwd()

		// Fetch with timeout and --prune to clean stale remote refs
		fetchCtx, fetchCancel := context.WithTimeout(context.Background(), 30*time.Second)
		fetchCmd := exec.CommandContext(fetchCtx, "git", "fetch", "--prune")
		fetchCmd.Dir = cwd
		_ = fetchCmd.Run()
		fetchCancel()

		// Count stash entries BEFORE stashing (locale-safe detection)
		stashCountBefore := countGitStash(cwd)

		// Stash any uncommitted work (including untracked files) to avoid conflicts
		stashCtx, stashCancel := context.WithTimeout(context.Background(), 10*time.Second)
		stashCmd := exec.CommandContext(stashCtx, "git", "stash", "--include-untracked")
		stashCmd.Dir = cwd
		_ = stashCmd.Run()
		stashCancel()

		stashCountAfter := countGitStash(cwd)
		didStash := stashCountAfter > stashCountBefore

		// Checkout with timeout
		checkoutCtx, checkoutCancel := context.WithTimeout(context.Background(), 10*time.Second)
		cmd := exec.CommandContext(checkoutCtx, "git", "checkout", targetEnv.GitBranch)
		cmd.Dir = cwd
		output, err := cmd.CombinedOutput()
		checkoutCancel()

		if err != nil {
			// If checkout failed and we stashed, restore the stash
			if didStash {
				popCmd := exec.Command("git", "stash", "pop")
				popCmd.Dir = cwd
				_ = popCmd.Run()
			}
			results = append(results, fmt.Sprintf("  ❌ git branch — failed: %v (%s)", err, strings.TrimSpace(string(output))))
			hasErrors = true
		} else {
			results = append(results, fmt.Sprintf("  📌 git branch — %s", targetEnv.GitBranch))
			// Warn user that their changes are stashed
			if didStash {
				results = append(results, "  ⚠️  uncommitted changes stashed (run 'git stash pop' to restore)")
			}
		}
	}

	// ── Display results ──
	fmt.Println("  ─────────────────────────────────────────")
	for _, r := range results {
		fmt.Println(r)
	}
	fmt.Println("  ─────────────────────────────────────────")

	if len(results) == 0 {
		fmt.Println("  (no profiles configured for this environment)")
	}

	totalDuration := time.Since(startTime)

	if hasErrors {
		fmt.Printf("\n  ⚠️  \033[1;33mContext switch completed with warnings\033[0m (%dms)\n", totalDuration.Milliseconds())
	} else {
		fmt.Printf("\n  ✅ \033[1;32mContext switch complete!\033[0m (%dms)\n", totalDuration.Milliseconds())
	}

	// Write shell script silently (the shell wrapper auto-sources it)
	if len(shellLines) > 0 {
		shellScript := strings.Join(shellLines, "\n")

		home, _ := os.UserHomeDir()
		ext := ".sh"
		if runtime.GOOS == "windows" {
			ext = ".ps1"
		}
		scriptPath := home + "/.nexus/last_switch" + ext
		os.MkdirAll(home+"/.nexus", 0700)
		os.WriteFile(scriptPath, []byte(shellScript), 0600)
	}

	// ── Write local audit log as backup ──
	localAudit, auditErr := audit.NewFileLogger()
	if auditErr == nil {
		entry := domain.NewAuditEntry(domain.AuditActionSwitch, projectDTO.Name, envName, "",
			fmt.Sprintf("Switched to %s/%s", projectDTO.Slug, envName))
		entry.Success = !hasErrors
		entry.DurationMs = totalDuration.Milliseconds()
		_ = localAudit.Log(entry)
	}

	// ── Push audit log to API ──
	client := repository.NewAPIClient(getAPIURL())
	_ = client.PushAudit(repository.AuditEntryDTO{
		Action:      "switch",
		ProjectName: projectDTO.Name,
		Environment: envName,
		Message:     fmt.Sprintf("Switched to %s/%s", projectDTO.Slug, envName),
		Success:     !hasErrors,
		DurationMs:  totalDuration.Milliseconds(),
	})

	if !hasErrors {
		_ = state.SaveActiveState(domain.ActiveState{
			ProjectName: projectDTO.Name,
			Environment: envName,
			Timestamp:   time.Now().UTC(),
		})
	}

	return nil
}

// countGitStash returns the number of stash entries (locale-safe).
func countGitStash(dir string) int {
	cmd := exec.Command("git", "stash", "list")
	cmd.Dir = dir
	output, err := cmd.Output()
	if err != nil {
		return 0
	}
	trimmed := strings.TrimSpace(string(output))
	if trimmed == "" {
		return 0
	}
	return len(strings.Split(trimmed, "\n"))
}

// switchLocal performs a switch using the local YAML configuration file.
func switchLocal(args []string, envName string) error {
	orch, err := buildOrchestrator()
	if err != nil {
		return err
	}

	configPath := cfgFile
	if len(args) > 0 {
		_ = args[0] // Future: resolve project name to config path
	}

	fmt.Printf("  🚀 Switching context → \033[1;36m%s\033[0m (local)\n\n", envName)

	result, err := orch.Switch(configPath, envName)
	if err != nil {
		return fmt.Errorf("switch failed: %w", err)
	}

	fmt.Println("  ─────────────────────────────────────────")
	for _, sr := range result.SkillResults {
		fmt.Printf("  %s\n", sr.Summary())
	}
	fmt.Println("  ─────────────────────────────────────────")

	if result.Success {
		fmt.Printf("\n  ✅ \033[1;32mContext switch complete!\033[0m (%dms)\n", result.TotalDuration.Milliseconds())
	} else {
		fmt.Printf("\n  ⚠️  \033[1;33mContext switch completed with warnings\033[0m (%dms)\n", result.TotalDuration.Milliseconds())
	}

	if result.ShellScript != "" {
		fmt.Println("\n  📋 To apply environment variables, run:")
		fmt.Println("  ─────────────────────────────────────────")
		for _, line := range strings.Split(result.ShellScript, "\n") {
			if strings.TrimSpace(line) != "" {
				fmt.Printf("  %s\n", line)
			}
		}
		fmt.Println("  ─────────────────────────────────────────")

		home, _ := os.UserHomeDir()
		ext := ".sh"
		if runtime.GOOS == "windows" {
			ext = ".ps1"
		}
		scriptPath := home + "/.nexus/last_switch" + ext
		os.WriteFile(scriptPath, []byte(result.ShellScript), 0600)
		fmt.Printf("\n  💡 Or source it directly:\n")
		fmt.Printf("     . %s\n", scriptPath)
	}

	if result.Success {
		_ = state.SaveActiveState(domain.ActiveState{
			ProjectName: result.ProjectName,
			Environment: result.Environment,
			Timestamp:   time.Now().UTC(),
		})
	}

	return nil
}

// buildOrchestrator wires up all adapters and creates the orchestrator.
func buildOrchestrator() (*service.Orchestrator, error) {
	reader := config.NewYAMLReader()

	envInjector := executor.NewEnvInjector()
	gitSwitcher := executor.NewGitSwitcher()
	scriptRunner := executor.NewScriptRunner()

	allProfilers := executor.AllProfilers()
	cliProfilers := make([]port.CLIProfiler, 0, len(allProfilers))
	for _, p := range allProfilers {
		cliProfilers = append(cliProfilers, p)
	}

	auditLogger, err := audit.NewFileLogger()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize audit logger: %w", err)
	}

	shellEmitter := executor.DetectShellEmitter()

	orch := service.NewOrchestrator(service.OrchestratorConfig{
		ConfigReader:  reader,
		Executors:     []port.SkillExecutor{envInjector, gitSwitcher, scriptRunner},
		CLIProfilers:  cliProfilers,
		AuditLogger:   auditLogger,
		ShellEmitter:  shellEmitter,
	})

	return orch, nil
}
