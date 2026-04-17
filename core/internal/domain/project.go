package domain

import (
	"fmt"
)

// Environment represents a deployment target environment.
type Environment string

const (
	EnvDevelopment Environment = "development"
	EnvStaging     Environment = "staging"
	EnvProduction  Environment = "production"
)

// CLIProfile defines the authentication identity for a specific CLI tool.
// This is the core of Nexus: each project can have different
// GitHub accounts, AWS profiles, Supabase orgs, etc.
type CLIProfile struct {
	Tool    string `yaml:"tool" json:"tool"`       // e.g., "gh", "aws", "supabase", "vercel", "mongosh"
	Account string `yaml:"account" json:"account"` // e.g., GitHub username, AWS profile name
	Org     string `yaml:"org,omitempty" json:"org,omitempty"` // e.g., Supabase org, Vercel team
	Region  string `yaml:"region,omitempty" json:"region,omitempty"` // e.g., AWS region
	Extra   map[string]string `yaml:"extra,omitempty" json:"extra,omitempty"` // Tool-specific config
}

// ScriptHook defines a command to run pre or post context switch.
type ScriptHook struct {
	Name    string `yaml:"name" json:"name"`        // Display name
	Command string `yaml:"command" json:"command"`  // Shell command to execute
	Phase   string `yaml:"phase" json:"phase"`      // "pre" or "post"
	Timeout int    `yaml:"timeout,omitempty" json:"timeout,omitempty"` // seconds, 0 = no timeout
}

// EnvironmentConfig holds the full context for a given environment
// within a project: branch, env vars, and CLI profiles.
type EnvironmentConfig struct {
	Name         Environment       `yaml:"name" json:"name"`
	Branch       string            `yaml:"branch" json:"branch"`
	EnvVars      map[string]string `yaml:"env" json:"env"`
	CLIProfiles  []CLIProfile      `yaml:"cli_profiles" json:"cli_profiles"`
	Hooks        []ScriptHook      `yaml:"hooks,omitempty" json:"hooks,omitempty"`
}

// Project is the top-level entity representing a development project.
// It aggregates environments, skills, and the metadata needed for
// the Orchestrator to perform a full context switch.
type Project struct {
	Name         string                       `yaml:"name" json:"name"`
	Slug         string                       `yaml:"slug" json:"slug"`
	RepoURL      string                       `yaml:"repo" json:"repo"`
	RootPath     string                       `yaml:"root_path,omitempty" json:"root_path,omitempty"`
	Environments map[string]EnvironmentConfig `yaml:"environments" json:"environments"`
	Skills       []Skill                      `yaml:"skills" json:"skills"`
}

// Validate checks that the project has minimum required fields.
func (p *Project) Validate() error {
	if p.Name == "" {
		return fmt.Errorf("project name is required")
	}
	if p.Slug == "" {
		return fmt.Errorf("project slug is required")
	}
	if len(p.Environments) == 0 {
		return fmt.Errorf("at least one environment must be defined for project '%s'", p.Name)
	}
	for _, s := range p.Skills {
		if err := s.Validate(); err != nil {
			return fmt.Errorf("project '%s': %w", p.Name, err)
		}
	}
	return nil
}

// GetEnvironment returns the configuration for a specified environment.
func (p *Project) GetEnvironment(env string) (*EnvironmentConfig, error) {
	ec, ok := p.Environments[env]
	if !ok {
		available := make([]string, 0, len(p.Environments))
		for k := range p.Environments {
			available = append(available, k)
		}
		return nil, fmt.Errorf("environment '%s' not found in project '%s' (available: %v)", env, p.Name, available)
	}
	return &ec, nil
}

// GetEnabledSkills returns skills that are enabled, sorted by priority.
func (p *Project) GetEnabledSkills() []Skill {
	enabled := make([]Skill, 0)
	for _, s := range p.Skills {
		if s.Enabled {
			enabled = append(enabled, s)
		}
	}
	// Sort by priority (lower number = higher priority)
	for i := 0; i < len(enabled); i++ {
		for j := i + 1; j < len(enabled); j++ {
			if enabled[j].Priority < enabled[i].Priority {
				enabled[i], enabled[j] = enabled[j], enabled[i]
			}
		}
	}
	return enabled
}

// GetCLIProfiles returns CLI profiles for a specific environment.
func (p *Project) GetCLIProfiles(env string) ([]CLIProfile, error) {
	ec, err := p.GetEnvironment(env)
	if err != nil {
		return nil, err
	}
	return ec.CLIProfiles, nil
}
