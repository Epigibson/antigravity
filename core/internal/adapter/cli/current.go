package cli

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/nexus-dev/nexus/internal/adapter/state"
)

func newCurrentCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "current",
		Aliases: []string{"check"},
		Short:   "🔍 Show the currently active project and environment",
		Long:    `Reads the active context state to determine the current project environment.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			shellProject := os.Getenv("NEXUS_ACTIVE_WORKSPACE")
			shellEnv := os.Getenv("NEXUS_ACTIVE_ENV")

			globalState, err := state.LoadActiveState()
			if err != nil {
				if shellProject != "" {
					fmt.Printf("  No global state found, but terminal is set to: %s/%s\n", shellProject, shellEnv)
					fmt.Println("  Run 'nexus switch' to stabilize the global state.")
					return nil
				}
				fmt.Println("  No active context found. Run 'nexus switch' to set one.")
				return nil
			}

			fmt.Print(banner)
			fmt.Println("  🎯 Current Active Context")
			fmt.Println("  ─────────────────────────────────────────")
			fmt.Printf("  Global Project:      \033[1;36m%s\033[0m\n", globalState.ProjectName)
			fmt.Printf("  Global Environment:  \033[1;33m%s\033[0m\n", globalState.Environment)
			
			timeAgo := time.Since(globalState.Timestamp).Round(time.Second)
			fmt.Printf("  Last Switched:       %s ago\n", timeAgo)

			fmt.Println("  ─────────────────────────────────────────")

			if shellProject == "" || shellEnv == "" {
				fmt.Println("  ⚠️  \033[1;33mShell Warning:\033[0m Your current terminal session is NOT initialized.")
				fmt.Println("      Environment variables for this project are missing.")
				fmt.Println("      Run 'nexus switch' again or open a new initialized terminal.")
			} else if shellProject != globalState.ProjectName || shellEnv != globalState.Environment {
				fmt.Println("  ⚠️  \033[1;31mState Mismatch:\033[0m Your terminal session differs from the global state.")
				fmt.Printf("      Terminal Project: %s\n", shellProject)
				fmt.Printf("      Terminal Env:     %s\n", shellEnv)
			} else {
				fmt.Println("  Status:              ✅ Shell and Global state match perfectly")
			}
			
			fmt.Println("  ─────────────────────────────────────────")
			fmt.Println("  Run 'nexus profiles' to see live CLI status.")

			return nil
		},
	}
}
