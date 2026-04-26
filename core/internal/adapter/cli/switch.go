package cli

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"sort"
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
// It converts the API DTO to a domain.Project (including skills and hooks),
// then delegates to the same Orchestrator used by Local Mode.
// This ensures a single source of truth for all switch logic.
func switchFromAPI(projectDTO *repository.ProjectDTO, envName string) error {
	// Convert API DTO to domain model (includes skills + hooks)
	project := config.ProjectDTOToDomain(projectDTO)

	// Show active skills summary
	enabledSkills := project.GetEnabledSkills()
	fmt.Printf("  🧩 Skills: %d/%d enabled\n", len(enabledSkills), len(project.Skills))

	// Build the orchestrator (same one used by Local Mode)
	orch, err := buildOrchestrator()
	if err != nil {
		return fmt.Errorf("failed to build orchestrator: %w", err)
	}

	// Start spinner
	ctx, cancel := context.WithCancel(context.Background())
	go showSpinner(ctx, fmt.Sprintf("Switching context to \033[1;36m%s\033[0m... please wait", envName))

	// Execute the switch through the Orchestrator
	// Pass empty string as projectPath since we already have the project loaded
	result, err := orch.SwitchWithProject(project, envName)
	cancel() // Stop spinner
	
	// Clear the spinner line
	fmt.Printf("\r\033[K")

	if err != nil {
		return fmt.Errorf("switch failed: %w", err)
	}

	// Sort results by status, then alphabetically
	sortSkillResults(result.SkillResults)

	// Display results
	fmt.Println("  ─────────────────────────────────────────")
	for _, sr := range result.SkillResults {
		if sr.Status != domain.SkillStatusSkipped {
			fmt.Printf("  %s\n", sr.Summary())
		}
	}
	fmt.Println("  ─────────────────────────────────────────")

	if result.Success {
		fmt.Printf("\n  ✨ \033[1;32mContext switch complete!\033[0m (%dms)\n", result.TotalDuration.Milliseconds())
	} else {
		fmt.Printf("\n  ⚠️  \033[1;33mContext switch completed with warnings\033[0m (%dms)\n", result.TotalDuration.Milliseconds())
	}

	// Write shell script for env var sourcing
	if result.ShellScript != "" {
		home, _ := os.UserHomeDir()
		ext := ".sh"
		if runtime.GOOS == "windows" {
			ext = ".ps1"
		}
		scriptPath := home + "/.nexus/last_switch" + ext
		os.MkdirAll(home+"/.nexus", 0700)
		os.WriteFile(scriptPath, []byte(result.ShellScript), 0600)
	}

	if result.Success {
		_ = state.SaveActiveState(domain.ActiveState{
			ProjectName: project.Name,
			Environment: envName,
			Timestamp:   time.Now().UTC(),
		})
	}

	return nil
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

	// Start spinner
	ctx, cancel := context.WithCancel(context.Background())
	go showSpinner(ctx, fmt.Sprintf("Switching context to \033[1;36m%s\033[0m... please wait", envName))

	result, err := orch.Switch(configPath, envName)
	cancel() // Stop spinner

	// Clear the spinner line
	fmt.Printf("\r\033[K")

	if err != nil {
		return fmt.Errorf("switch failed: %w", err)
	}

	// Sort results by status, then alphabetically
	sortSkillResults(result.SkillResults)

	fmt.Println("  ─────────────────────────────────────────")
	for _, sr := range result.SkillResults {
		if sr.Status != domain.SkillStatusSkipped {
			fmt.Printf("  %s\n", sr.Summary())
		}
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
	docGenerator := executor.NewDocGenerator()
	cloudAuditSync := executor.NewCloudAuditSync()
	sandbox := executor.NewSandbox()
	teamSync := executor.NewTeamContextSync()
	secretRotation := executor.NewSecretRotation()

	allProfilers := executor.AllProfilers()
	cliProfilers := make([]port.CLIProfiler, 0, len(allProfilers))
	for _, p := range allProfilers {
		cliProfilers = append(cliProfilers, p)
	}

	localLogger, err := audit.NewFileLogger()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize audit logger: %w", err)
	}

	apiClient := repository.NewAPIClient(getAPIURL())
	auditLogger := audit.NewMultiLogger(localLogger, apiClient)

	shellEmitter := executor.DetectShellEmitter()

	// Build the base executors map
	baseExecutors := []port.SkillExecutor{
		envInjector, gitSwitcher, scriptRunner, docGenerator,
		cloudAuditSync, sandbox, teamSync, secretRotation,
	}

	// Create a map for the parallel executor to reference
	executorMap := make(map[string]port.SkillExecutor)
	for _, e := range baseExecutors {
		executorMap[e.Name()] = e
	}

	// Create the parallel executor (wraps all other executors for concurrent execution)
	parallelExecutor := executor.NewParallelExecutor(executorMap)

	// All executors including the parallel one
	allExecutors := append(baseExecutors, parallelExecutor)

	orch := service.NewOrchestrator(service.OrchestratorConfig{
		ConfigReader:  reader,
		Executors:     allExecutors,
		CLIProfilers:  cliProfilers,
		AuditLogger:   auditLogger,
		ShellEmitter:  shellEmitter,
	})

	return orch, nil
}

// sortSkillResults orders the results primarily by Status (Failures -> Success -> Skipped)
// and secondarily alphabetically by SkillName.
func sortSkillResults(results []domain.SkillResult) {
	statusWeight := func(status domain.SkillStatus) int {
		switch status {
		case domain.SkillStatusFailed:
			return 0
		case domain.SkillStatusSuccess:
			return 1
		case domain.SkillStatusSkipped:
			return 4
		default:
			return 2
		}
	}

	sort.Slice(results, func(i, j int) bool {
		w1 := statusWeight(results[i].Status)
		w2 := statusWeight(results[j].Status)
		if w1 == w2 {
			return results[i].SkillName < results[j].SkillName
		}
		return w1 < w2
	})
}

// showSpinner displays an animated braille spinner until the context is canceled.
func showSpinner(ctx context.Context, message string) {
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	i := 0
	for {
		select {
		case <-ctx.Done():
			return
		default:
			fmt.Printf("\r  \033[1;33m%s\033[0m %s", frames[i%len(frames)], message)
			i++
			time.Sleep(80 * time.Millisecond)
		}
	}
}
