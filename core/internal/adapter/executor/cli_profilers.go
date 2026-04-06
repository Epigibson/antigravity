package executor

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/antigravity-dev/antigravity/internal/domain"
)

// ============================================================================
// GitHub CLI Profiler (gh)
// ============================================================================

// GitHubProfiler manages GitHub CLI (gh) account switching.
// If the account isn't already logged in, it uses GH_TOKEN from
// env vars or the Extra field to authenticate automatically.
type GitHubProfiler struct{}

func NewGitHubProfiler() *GitHubProfiler { return &GitHubProfiler{} }

func (g *GitHubProfiler) ToolName() string { return "gh" }

func (g *GitHubProfiler) IsInstalled() bool {
	_, err := exec.LookPath("gh")
	return err == nil
}

func (g *GitHubProfiler) CurrentProfile() (string, error) {
	cmd := exec.Command("gh", "auth", "status")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "none", nil
	}
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "account") {
			parts := strings.Fields(line)
			for i, p := range parts {
				if p == "account" && i+1 < len(parts) {
					return strings.Trim(parts[i+1], " ()"), nil
				}
			}
		}
		if strings.Contains(line, "Logged in") {
			return strings.TrimSpace(line), nil
		}
	}
	return "unknown", nil
}

func (g *GitHubProfiler) Switch(profile domain.CLIProfile) error {
	// Step 1: Try switching to an existing session
	cmd := exec.Command("gh", "auth", "switch", "--user", profile.Account)
	_, err := cmd.CombinedOutput()
	if err == nil {
		return nil // Switch succeeded, already logged in
	}

	// Step 2: Try auto-login with token from Extra["token"] or env GH_TOKEN
	token := ""
	if profile.Extra != nil {
		if t, ok := profile.Extra["token"]; ok && t != "" {
			token = t
		}
	}
	if token == "" {
		token = os.Getenv("GH_TOKEN")
	}

	if token != "" {
		// Login with token via stdin: echo TOKEN | gh auth login --with-token
		loginCmd := exec.Command("gh", "auth", "login", "--with-token")
		loginCmd.Stdin = strings.NewReader(token)
		output, loginErr := loginCmd.CombinedOutput()
		if loginErr != nil {
			return fmt.Errorf("gh auto-login failed: %s", strings.TrimSpace(string(output)))
		}
		return nil
	}

	return fmt.Errorf("gh: account '%s' not found. Add a GH_TOKEN in your environment variables or authenticate manually with 'gh auth login'", profile.Account)
}

func (g *GitHubProfiler) ListProfiles() ([]string, error) {
	cmd := exec.Command("gh", "auth", "status")
	output, _ := cmd.CombinedOutput()
	var profiles []string
	for _, line := range strings.Split(string(output), "\n") {
		if strings.Contains(line, "account") || strings.Contains(line, "Logged in") {
			profiles = append(profiles, strings.TrimSpace(line))
		}
	}
	return profiles, nil
}

// ============================================================================
// AWS CLI Profiler
// ============================================================================

// AWSProfiler manages AWS CLI profile switching.
// Can authenticate using AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
// from the environment's env_vars, or switch between named profiles.
type AWSProfiler struct{}

func NewAWSProfiler() *AWSProfiler { return &AWSProfiler{} }

func (a *AWSProfiler) ToolName() string { return "aws" }

func (a *AWSProfiler) IsInstalled() bool {
	_, err := exec.LookPath("aws")
	return err == nil
}

func (a *AWSProfiler) CurrentProfile() (string, error) {
	// Check AWS_PROFILE env var first
	if p := os.Getenv("AWS_PROFILE"); p != "" {
		return p, nil
	}
	cmd := exec.Command("aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "none", nil
	}
	return strings.TrimSpace(string(output)), nil
}

func (a *AWSProfiler) Switch(profile domain.CLIProfile) error {
	// Step 1: Set AWS_PROFILE for named profile switching
	os.Setenv("AWS_PROFILE", profile.Account)

	// Step 2: If Extra has access keys, configure them directly
	if profile.Extra != nil {
		if key, ok := profile.Extra["access_key_id"]; ok && key != "" {
			os.Setenv("AWS_ACCESS_KEY_ID", key)
		}
		if secret, ok := profile.Extra["secret_access_key"]; ok && secret != "" {
			os.Setenv("AWS_SECRET_ACCESS_KEY", secret)
		}
	}

	// Step 3: Set region if provided
	if profile.Region != "" {
		os.Setenv("AWS_DEFAULT_REGION", profile.Region)
		os.Setenv("AWS_REGION", profile.Region)
	}

	// Step 4: Verify authentication works
	cmd := exec.Command("aws", "sts", "get-caller-identity")
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Try SSO login as last resort
		loginCmd := exec.Command("aws", "sso", "login", "--profile", profile.Account)
		loginOutput, loginErr := loginCmd.CombinedOutput()
		if loginErr != nil {
			return fmt.Errorf("aws: could not authenticate. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment variables. Error: %s | SSO: %s",
				strings.TrimSpace(string(output)), strings.TrimSpace(string(loginOutput)))
		}
	}
	return nil
}

func (a *AWSProfiler) ListProfiles() ([]string, error) {
	cmd := exec.Command("aws", "configure", "list-profiles")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to list AWS profiles: %s", strings.TrimSpace(string(output)))
	}
	profiles := strings.Split(strings.TrimSpace(string(output)), "\n")
	return profiles, nil
}

// ============================================================================
// Supabase CLI Profiler
// ============================================================================

// SupabaseProfiler manages Supabase CLI project linking.
// Uses access token from Extra["token"] or SUPABASE_ACCESS_TOKEN env var.
type SupabaseProfiler struct{}

func NewSupabaseProfiler() *SupabaseProfiler { return &SupabaseProfiler{} }

func (s *SupabaseProfiler) ToolName() string { return "supabase" }

func (s *SupabaseProfiler) IsInstalled() bool {
	_, err := exec.LookPath("supabase")
	return err == nil
}

func (s *SupabaseProfiler) CurrentProfile() (string, error) {
	return "unknown", nil
}

func (s *SupabaseProfiler) Switch(profile domain.CLIProfile) error {
	// Step 1: If there's an access token, set it for the CLI
	if profile.Extra != nil {
		if token, ok := profile.Extra["token"]; ok && token != "" {
			os.Setenv("SUPABASE_ACCESS_TOKEN", token)
		}
		if dbPass, ok := profile.Extra["db_password"]; ok && dbPass != "" {
			os.Setenv("SUPABASE_DB_PASSWORD", dbPass)
		}
	}

	// Step 2: Link to the specified project
	args := []string{"link", "--project-ref", profile.Account}
	if profile.Extra != nil {
		if password, ok := profile.Extra["db_password"]; ok {
			args = append(args, "--password", password)
		}
	}
	cmd := exec.Command("supabase", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("supabase link failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func (s *SupabaseProfiler) ListProfiles() ([]string, error) {
	cmd := exec.Command("supabase", "projects", "list")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(string(output)), "\n"), nil
}

// ============================================================================
// Vercel CLI Profiler
// ============================================================================

// VercelProfiler manages Vercel CLI scope/team switching.
// Can authenticate using a token from Extra["token"] or VERCEL_TOKEN.
type VercelProfiler struct{}

func NewVercelProfiler() *VercelProfiler { return &VercelProfiler{} }

func (v *VercelProfiler) ToolName() string { return "vercel" }

func (v *VercelProfiler) IsInstalled() bool {
	_, err := exec.LookPath("vercel")
	return err == nil
}

func (v *VercelProfiler) CurrentProfile() (string, error) {
	cmd := exec.Command("vercel", "whoami")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "none", nil
	}
	return strings.TrimSpace(string(output)), nil
}

func (v *VercelProfiler) Switch(profile domain.CLIProfile) error {
	// Get token from Extra or env var
	token := ""
	if profile.Extra != nil {
		if t, ok := profile.Extra["token"]; ok && t != "" {
			token = t
		}
	}
	if token == "" {
		token = os.Getenv("VERCEL_TOKEN")
	}

	if token != "" {
		os.Setenv("VERCEL_TOKEN", token)
	} else {
		return fmt.Errorf("vercel: no token found. Add a Vercel Token in your dashboard profile credentials")
	}

	// Verify token works
	args := []string{"whoami", "--token", token}
	cmd := exec.Command("vercel", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("vercel auth failed: %s", strings.TrimSpace(string(output)))
	}

	// Link project with --token and --scope (if org provided)
	if profile.Account != "" {
		linkArgs := []string{"link", "--project", profile.Account, "--yes", "--token", token}
		if profile.Org != "" {
			linkArgs = append(linkArgs, "--scope", profile.Org)
		}
		linkCmd := exec.Command("vercel", linkArgs...)
		linkOutput, linkErr := linkCmd.CombinedOutput()
		if linkErr != nil {
			return fmt.Errorf("vercel link failed: %s", strings.TrimSpace(string(linkOutput)))
		}
	}
	return nil
}

func (v *VercelProfiler) ListProfiles() ([]string, error) {
	cmd := exec.Command("vercel", "teams", "list")
	output, _ := cmd.CombinedOutput()
	return strings.Split(strings.TrimSpace(string(output)), "\n"), nil
}

// ============================================================================
// MongoDB Profiler (mongosh / Atlas CLI)
// ============================================================================

// MongoProfiler manages MongoDB connection switching.
// Uses MONGODB_URI from env vars for connection string switching.
type MongoProfiler struct{}

func NewMongoProfiler() *MongoProfiler { return &MongoProfiler{} }

func (m *MongoProfiler) ToolName() string { return "mongosh" }

func (m *MongoProfiler) IsInstalled() bool {
	_, err := exec.LookPath("mongosh")
	if err != nil {
		_, err = exec.LookPath("atlas")
		return err == nil
	}
	return true
}

func (m *MongoProfiler) CurrentProfile() (string, error) {
	cmd := exec.Command("atlas", "config", "describe")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "none", nil
	}
	return strings.TrimSpace(string(output)), nil
}

func (m *MongoProfiler) Switch(profile domain.CLIProfile) error {
	// Step 1: Set connection string from Extra
	if profile.Extra != nil {
		if uri, ok := profile.Extra["uri"]; ok && uri != "" {
			os.Setenv("MONGODB_URI", uri)
		}
	}

	// Step 2: Try Atlas CLI profile switching
	if _, err := exec.LookPath("atlas"); err == nil && profile.Account != "" {
		cmd := exec.Command("atlas", "config", "set", "-P", profile.Account)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("atlas config set failed: %s", strings.TrimSpace(string(output)))
		}
	}
	return nil
}

func (m *MongoProfiler) ListProfiles() ([]string, error) {
	if _, err := exec.LookPath("atlas"); err != nil {
		return []string{"(atlas CLI not installed - using env vars)"}, nil
	}
	cmd := exec.Command("atlas", "config", "list")
	output, _ := cmd.CombinedOutput()
	return strings.Split(strings.TrimSpace(string(output)), "\n"), nil
}

// ============================================================================
// Registry — Factory for all profilers
// ============================================================================

// AllProfilers returns instances of all supported CLI profilers.
func AllProfilers() []interface {
	ToolName() string
	IsInstalled() bool
	CurrentProfile() (string, error)
	Switch(profile domain.CLIProfile) error
	ListProfiles() ([]string, error)
} {
	return []interface {
		ToolName() string
		IsInstalled() bool
		CurrentProfile() (string, error)
		Switch(profile domain.CLIProfile) error
		ListProfiles() ([]string, error)
	}{
		NewGitHubProfiler(),
		NewAWSProfiler(),
		NewSupabaseProfiler(),
		NewVercelProfiler(),
		NewMongoProfiler(),
	}
}
