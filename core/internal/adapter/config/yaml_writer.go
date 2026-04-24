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
	"Env Injector":     domain.SkillCategoryContext,
	"Branch Switcher":  domain.SkillCategoryGit,
	"Git Context":      domain.SkillCategoryGit,
	"CLI Profiler":     domain.SkillCategoryCLI,
	"Script Runner":    domain.SkillCategoryScripts,
	"Context Snapshot": domain.SkillCategoryContext,
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
		category, ok := skillNameToCategory[skillDTO.Name]
		if !ok {
			// Skip unknown skills (premium features not yet implemented)
			continue
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

