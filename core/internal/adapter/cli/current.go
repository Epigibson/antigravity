package cli

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/nexus-dev/nexus/internal/adapter/audit"
)

func newCurrentCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "current",
		Aliases: []string{"check"},
		Short:   "🔍 Show the currently active project and environment",
		Long:    `Reads the local audit log to determine the last successful context switch.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			logger, err := audit.NewFileLogger()
			if err != nil {
				return fmt.Errorf("could not access audit log: %w", err)
			}

			logs, err := logger.GetLogs("", 10)
			if err != nil || len(logs) == 0 {
				fmt.Println("  No active context found. Run 'nexus switch' to set one.")
				return nil
			}

			// Find last switch action
			for _, entry := range logs {
				if entry.Action == "switch" {
					fmt.Print(banner)
					fmt.Println("  🎯 Current Active Context")
					fmt.Println("  ─────────────────────────────────────────")
					fmt.Printf("  Project:     \033[1;36m%s\033[0m\n", entry.ProjectName)
					fmt.Printf("  Environment: \033[1;33m%s\033[0m\n", entry.Environment)
					
					timeAgo := time.Since(entry.Timestamp).Round(time.Second)
					fmt.Printf("  Switched:    %s ago\n", timeAgo)
					
					if !entry.Success {
						fmt.Println("  Status:      ⚠️  Completed with errors")
					} else {
						fmt.Println("  Status:      ✅ Healthy")
					}
					fmt.Println("  ─────────────────────────────────────────")
					fmt.Println("  Run 'nexus profiles' to see live CLI status.")
					return nil
				}
			}

			fmt.Println("  No active context found in recent history.")
			return nil
		},
	}
}
