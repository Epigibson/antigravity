package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

const version = "0.1.0"

const banner = `
    _   __                     
   / | / /__  _  ____  _______ 
  /  |/ / _ \| |/_/ / / / ___/ 
 / /|  /  __/>  </ /_/ (__  )  
/_/ |_/\___/_/|_|\__,_/____/   
`

var (
	cfgFile string
)

// NewRootCmd creates the root CLI command for Nexus.
func NewRootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "nexus",
		Short: "⚡ Development Environment Control Center",
		Long: banner + `
  Nexus eliminates context switching friction for developers.
  One command to switch your entire development identity:
  GitHub, AWS, Supabase, Vercel, MongoDB, and every CLI session.

  Usage:
    nexus switch <project> [--env environment]
    nexus setup-shell
    nexus init
    nexus list
    nexus profiles <project>`,
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	// Global flags
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "Path to nexus.yaml config file")

	// Add subcommands
	rootCmd.AddCommand(newSwitchCmd())
	rootCmd.AddCommand(newInitCmd())
	rootCmd.AddCommand(newSetupShellCmd())
	rootCmd.AddCommand(newListCmd())
	rootCmd.AddCommand(newProfilesCmd())
	rootCmd.AddCommand(newCurrentCmd())
	rootCmd.AddCommand(newVersionCmd())

	// Cloud commands
	rootCmd.AddCommand(newLoginCmd())
	rootCmd.AddCommand(newSyncCmd())
	rootCmd.AddCommand(newPullCmd())
	rootCmd.AddCommand(newStatusCmd())
	rootCmd.AddCommand(newLogoutCmd())

	return rootCmd
}

// Execute runs the root command.
func Execute() {
	rootCmd := NewRootCmd()
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}
}
