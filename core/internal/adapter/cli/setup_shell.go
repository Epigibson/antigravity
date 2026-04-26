package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

const shellWrapperCode = `
# Nexus CLI Wrapper
# Automates environment variable injections upon switching contexts
nexus() {
    command nexus "$@"
    if [[ "$1" == "switch" && -f "$HOME/.nexus/last_switch.sh" ]]; then
        source "$HOME/.nexus/last_switch.sh"
    fi
}
`

func newSetupShellCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "setup-shell",
		Short: "🔧 Automatically install the Nexus shell wrapper",
		Long: `Installs the Nexus shell wrapper into your ~/.bashrc or ~/.zshrc.
This wrapper allows Nexus to perfectly sync your live terminal environment
variables whenever you run 'nexus switch'.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			home, err := os.UserHomeDir()
			if err != nil {
				return fmt.Errorf("could not find home directory: %w", err)
			}

			// Determine which shells the user has
			shells := []string{
				filepath.Join(home, ".bashrc"),
				filepath.Join(home, ".zshrc"),
			}

			installedCount := 0

			for _, rcFile := range shells {
				if _, err := os.Stat(rcFile); err == nil {
					// Read the file to check if it's already installed
					content, err := os.ReadFile(rcFile)
					if err != nil {
						continue
					}

					if strings.Contains(string(content), "Nexus CLI Wrapper") {
						fmt.Printf("  ✅ Already installed in \033[1;36m%s\033[0m\n", filepath.Base(rcFile))
						installedCount++
						continue
					}

					// Append to file
					f, err := os.OpenFile(rcFile, os.O_APPEND|os.O_WRONLY, 0644)
					if err != nil {
						fmt.Printf("  ❌ Failed to write to \033[1;31m%s\033[0m: %v\n", filepath.Base(rcFile), err)
						continue
					}
					
					_, err = f.WriteString("\n" + shellWrapperCode)
					f.Close()

					if err == nil {
						fmt.Printf("  ✅ Successfully installed wrapper in \033[1;32m%s\033[0m\n", filepath.Base(rcFile))
						installedCount++
					}
				}
			}

			if installedCount == 0 {
				fmt.Println("  ⚠️  Could not find standard .bashrc or .zshrc files.")
				fmt.Println("  Please manually add the following code to your shell configuration:")
				fmt.Print(shellWrapperCode)
			} else {
				fmt.Println("\n  🎉 \033[1;32mSetup Complete!\033[0m")
				fmt.Println("  Please restart your terminal or run this command in your current window:")
				fmt.Println("  \033[1;33msource ~/.bashrc\033[0m (or ~/.zshrc)")
			}

			return nil
		},
	}
}
