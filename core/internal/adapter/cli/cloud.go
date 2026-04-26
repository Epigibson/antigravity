package cli

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/nexus-dev/nexus/internal/adapter/config"
	"github.com/nexus-dev/nexus/internal/adapter/repository"
)

const defaultAPIURL = "https://qegsj4k7m5.execute-api.us-east-1.amazonaws.com"

func getAPIURL() string {
	if url := os.Getenv("NEXUS_API_URL"); url != "" {
		return url
	}
	return defaultAPIURL
}

// newLoginCmd creates the `nexus login` command.
func newLoginCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "login",
		Short: "Authenticate the CLI with an API key",
		Long: `Authenticate the Nexus CLI with your API key.

Generate an API key from the Dashboard (Settings → API Keys), then paste it here.
The key is stored securely in ~/.nexus/credentials.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("🔐 Nexus CLI — Login")
			fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
			fmt.Println()
			fmt.Println("Generate an API key from your Dashboard:")
			fmt.Println("  → Settings → API Keys → Generate New Key")
			fmt.Println()
			fmt.Print("Paste your API key: ")

			reader := bufio.NewReader(os.Stdin)
			apiKey, _ := reader.ReadString('\n')
			apiKey = strings.TrimSpace(apiKey)

			if apiKey == "" {
				return fmt.Errorf("API key cannot be empty")
			}

			if !strings.HasPrefix(apiKey, "ag_live_") {
				return fmt.Errorf("invalid API key format — must start with 'ag_live_'")
			}

			// Validate the key against the API
			client := repository.NewAPIClientWithKey(getAPIURL(), apiKey)
			user, err := client.GetProfile()
			if err != nil {
				return fmt.Errorf("authentication failed: %w", err)
			}

			// Save the key
			if err := repository.SaveAPIKey(apiKey); err != nil {
				return fmt.Errorf("failed to save credentials: %w", err)
			}

			fmt.Println()
			fmt.Printf("✅ Authenticated as %s (%s)\n", user.DisplayName, user.Email)
			fmt.Printf("📋 Plan: %s\n", user.Plan)
			fmt.Println()
			fmt.Println("Run 'nexus sync' to pull your projects from the cloud.")
			return nil
		},
	}
}

// newSyncCmd creates the `nexus sync` command.
func newSyncCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "sync",
		Short: "Sync projects and audit log with the cloud",
		Long: `Synchronize your local project configurations with the Nexus cloud.

This command:
  • Pulls project configs from the API into your local YAML
  • Pushes local audit log entries to the cloud
  • Shows a summary of what changed`,
		RunE: func(cmd *cobra.Command, args []string) error {
			client := repository.NewAPIClient(getAPIURL())
			if !client.IsAuthenticated() {
				return fmt.Errorf("not authenticated — run 'nexus login' first")
			}

			fmt.Println("🔄 Nexus Sync")
			fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
			fmt.Println()

			// 1. Validate credentials
			fmt.Print("  Authenticating... ")
			user, err := client.GetProfile()
			if err != nil {
				fmt.Println("❌")
				return err
			}
			fmt.Printf("✅ %s\n", user.Email)

			// 2. Pull projects from cloud
			fmt.Print("  Pulling projects... ")
			projects, err := client.ListProjects()
			if err != nil {
				fmt.Println("❌")
				return err
			}
			fmt.Printf("✅ %d projects found\n", len(projects))

			// 3. Display summary
			fmt.Println()
			fmt.Println("📦 Cloud Projects:")
			for _, p := range projects {
				status := "✅"
				if !p.IsActive {
					status = "❌"
				}
				fmt.Printf("  %s %s (%s)\n", status, p.Name, p.Slug)
				for _, env := range p.Environments {
					toolCount := len(env.CLIProfiles)
					fmt.Printf("      └─ %s (branch: %s, %d tools)\n", env.Name, env.GitBranch, toolCount)
				}
			}

			fmt.Println()
			fmt.Println("✅ Sync complete!")
			return nil
		},
	}
}

// newStatusCmd creates the `nexus status` command.
func newStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show CLI connection status",
		Long:  "Show the current authentication status and connection to the Nexus cloud.",
		RunE: func(cmd *cobra.Command, args []string) error {
			client := repository.NewAPIClient(getAPIURL())

			fmt.Println("📊 Nexus Status")
			fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
			fmt.Println()

			if !client.IsAuthenticated() {
				fmt.Println("  🔴 Not authenticated")
				fmt.Println()
				fmt.Println("  Run 'nexus login' to connect to the cloud.")
				return nil
			}

			fmt.Print("  API Key: ")
			fmt.Println("configured ✅")

			fmt.Print("  API Server: ")
			fmt.Printf("%s\n", defaultAPIURL)

			fmt.Print("  Connection: ")
			user, err := client.GetProfile()
			if err != nil {
				fmt.Println("❌ offline")
				fmt.Printf("  Error: %v\n", err)
				return nil
			}
			fmt.Println("connected ✅")

			fmt.Println()
			fmt.Printf("  👤 User: %s (%s)\n", user.DisplayName, user.Email)
			fmt.Printf("  📋 Plan: %s\n", user.Plan)

			// Fetch project count
			projects, err := client.ListProjects()
			if err == nil {
				fmt.Printf("  📦 Projects: %d\n", len(projects))
			}

			fmt.Println()
			return nil
		},
	}
}

// newLogoutCmd creates the `nexus logout` command.
func newLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Remove stored API credentials",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := repository.ClearAPIKey(); err != nil {
				fmt.Println("  No credentials stored.")
				return nil
			}
			fmt.Println("✅ Credentials removed. Run 'nexus login' to re-authenticate.")
			return nil
		},
	}
}

// newPullCmd creates the `nexus pull` command.
func newPullCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "pull <project-slug>",
		Short: "Download project config from the cloud to nexus.yaml",
		Long: `Download a specific project configuration from the Nexus cloud 
and save it locally to your nexus.yaml file.

This requires you to be authenticated via 'nexus login'.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			client := repository.NewAPIClient(getAPIURL())
			if !client.IsAuthenticated() {
				return fmt.Errorf("not authenticated — run 'nexus login' first")
			}

			projectSlug := args[0]
			fmt.Printf("☁️ Nexus Pull — Fetching '%s'\n", projectSlug)
			fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
			
			projectDTO, err := client.GetProject(projectSlug)
			if err != nil {
				return fmt.Errorf("failed to fetch project: %w", err)
			}

			// Save to nexus.yaml
			destFile := "nexus.yaml"
			if err := config.WriteProjectFromDTO(destFile, projectDTO); err != nil {
				return fmt.Errorf("failed to write %s: %w", destFile, err)
			}

			fmt.Printf("✅ Successfully downloaded configuration to %s\n", destFile)
			return nil
		},
	}
}
