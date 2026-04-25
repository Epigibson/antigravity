package config

import (
	"fmt"
	"os"

	"github.com/nexus-dev/nexus/internal/adapter/repository"
	"github.com/nexus-dev/nexus/internal/domain"
	"gopkg.in/yaml.v3"
)

// skillNameToCategory maps API skill names to domain SkillCategory values.
// This bridges the gap between the backend's display names and the CLI's category-based executors.
var skillNameToCategory = map[string]domain.SkillCategory{
	"Env Injector":         domain.SkillCategoryContext,
	"Branch Switcher":      domain.SkillCategoryGit,
	"Git Context":          domain.SkillCategoryGit,
	"CLI Profiler":         domain.SkillCategoryCLI,
	"Script Runner":        domain.SkillCategoryScripts,
	"Context Snapshot":     domain.SkillCategoryContext,
	"Auto Documentation":   domain.SkillCategoryDocs,
	"Parallel Switch":      domain.SkillCategoryParallel,
	"Cloud Audit Sync":     domain.SkillCategoryContext,
	"Sandbox Environments": domain.SkillCategorySandbox,
	"Team Context Sync":    domain.SkillCategoryContext,
	"Secret Rotation":      domain.SkillCategoryCLI,
}

// apiCategoryToDomain maps API category strings to domain SkillCategory values.
// Used as a fallback when a skill name isn't in the explicit map above.
var apiCategoryToDomain = map[string]domain.SkillCategory{
	"context-injection": domain.SkillCategoryContext,
	"git-state":         domain.SkillCategoryGit,
	"cli-switching":     domain.SkillCategoryCLI,
	"documentation":     domain.SkillCategoryDocs,
	"sandbox":           domain.SkillCategorySandbox,
	"scripts":           domain.SkillCategoryScripts,
	"parallel":          domain.SkillCategoryParallel,
}

// ProjectDTOToDomain converts an API ProjectDTO (with skills and hooks) to a domain.Project.
// This is the bridge that allows Cloud Mode to reuse the same Orchestrator as Local Mode.
func ProjectDTOToDomain(dto *repository.ProjectDTO) *domain.Project {
	envs := make(map[string]domain.EnvironmentConfig)

	for _, envDTO := range dto.Environments {
		profiles := make([]domain.CLIProfile, 0, len(envDTO.CLIProfiles))
		for _, profDTO := range envDTO.CLIProfiles {
			profiles = append(profiles, domain.CLIProfile{
				Tool:    profDTO.Tool,
				Account: profDTO.Account,
				Region:  profDTO.Region,
				Org:     profDTO.Org,
				Extra:   profDTO.Extra,
			})
		}

		hooks := make([]domain.ScriptHook, 0, len(envDTO.Hooks))
		for _, hookDTO := range envDTO.Hooks {
			hooks = append(hooks, domain.ScriptHook{
				Name:    hookDTO.Name,
				Command: hookDTO.Command,
				Phase:   hookDTO.Phase,
				Timeout: hookDTO.Timeout,
			})
		}

		envs[envDTO.Name] = domain.EnvironmentConfig{
			Name:        domain.Environment(envDTO.Name),
			Branch:      envDTO.GitBranch,
			EnvVars:     envDTO.EnvVars,
			CLIProfiles: profiles,
			Hooks:       hooks,
		}
	}

	// Convert API skills to domain skills
	skills := make([]domain.Skill, 0, len(dto.Skills))
	for _, skillDTO := range dto.Skills {
		// Try explicit name mapping first, then fall back to API category field
		category, ok := skillNameToCategory[skillDTO.Name]
		if !ok {
			category, ok = apiCategoryToDomain[skillDTO.Category]
			if !ok {
				// Unknown category — skip to avoid runtime errors
				continue
			}
		}
		skills = append(skills, domain.Skill{
			Name:     skillDTO.Name,
			Category: category,
			Enabled:  skillDTO.IsEnabled,
			Priority: skillDTO.Priority,
		})
	}

	return &domain.Project{
		Name:         dto.Name,
		Slug:         dto.Slug,
		RepoURL:      dto.RepoURL,
		Environments: envs,
		Skills:       skills,
	}
}

// WriteProjectFromDTO translates an API ProjectDTO to the config structure and writes to a file
func WriteProjectFromDTO(path string, dto *repository.ProjectDTO) error {
	cfg := configFile{
		Version: "1",
		Project: projectMeta{
			Name:    dto.Name,
			Slug:    dto.Slug,
			RepoURL: dto.RepoURL,
		},
		Environments: make(map[string]domain.EnvironmentConfig),
	}

	for _, envDTO := range dto.Environments {
		profiles := make([]domain.CLIProfile, 0, len(envDTO.CLIProfiles))
		for _, profDTO := range envDTO.CLIProfiles {
			profiles = append(profiles, domain.CLIProfile{
				Tool:    profDTO.Tool,
				Account: profDTO.Account,
				Region:  profDTO.Region,
				Org:     profDTO.Org,
				Extra:   profDTO.Extra,
			})
		}

		hooks := make([]domain.ScriptHook, 0, len(envDTO.Hooks))
		for _, hookDTO := range envDTO.Hooks {
			hooks = append(hooks, domain.ScriptHook{
				Name:    hookDTO.Name,
				Command: hookDTO.Command,
				Phase:   hookDTO.Phase,
				Timeout: hookDTO.Timeout,
			})
		}

		cfg.Environments[envDTO.Name] = domain.EnvironmentConfig{
			Name:        domain.Environment(envDTO.Name),
			Branch:      envDTO.GitBranch,
			EnvVars:     envDTO.EnvVars,
			CLIProfiles: profiles,
			Hooks:       hooks,
		}
	}

	data, err := yaml.Marshal(&cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal to yaml: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}

	return nil
}

