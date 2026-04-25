package domain

import (
	"fmt"
	"time"
)

// SkillCategory represents the type of automation a skill performs.
type SkillCategory string

const (
	SkillCategoryContext  SkillCategory = "context-injection"
	SkillCategoryGit      SkillCategory = "git-state"
	SkillCategoryCLI      SkillCategory = "cli-switching"
	SkillCategoryDocs     SkillCategory = "documentation"
	SkillCategorySandbox  SkillCategory = "sandbox"
	SkillCategoryScripts  SkillCategory = "scripts"
	SkillCategoryParallel SkillCategory = "parallel"
)

// SkillStatus represents the execution result of a skill.
type SkillStatus string

const (
	SkillStatusPending  SkillStatus = "pending"
	SkillStatusRunning  SkillStatus = "running"
	SkillStatusSuccess  SkillStatus = "success"
	SkillStatusFailed   SkillStatus = "failed"
	SkillStatusSkipped  SkillStatus = "skipped"
)

// Skill represents a unit of automation in the Nexus system.
// Each skill is responsible for one aspect of context switching
// (e.g., injecting env vars, switching Git branches, switching CLI profiles).
type Skill struct {
	Name     string            `yaml:"name" json:"name"`
	Category SkillCategory     `yaml:"category" json:"category"`
	Enabled  bool              `yaml:"enabled" json:"enabled"`
	Priority int               `yaml:"priority" json:"priority"`
	Config   map[string]any    `yaml:"config,omitempty" json:"config,omitempty"`
}

// SkillResult captures the outcome of executing a single skill.
type SkillResult struct {
	SkillName   string        `json:"skill_name"`
	Status      SkillStatus   `json:"status"`
	Message     string        `json:"message"`
	Duration    time.Duration `json:"duration_ms"`
	Actions     []string      `json:"actions,omitempty"`
	Error       error         `json:"-"`
}

// Validate checks that a Skill has the minimum required fields.
func (s *Skill) Validate() error {
	if s.Name == "" {
		return fmt.Errorf("skill name is required")
	}
	if s.Category == "" {
		return fmt.Errorf("skill category is required for '%s'", s.Name)
	}
	if s.Priority < 0 {
		return fmt.Errorf("skill priority must be >= 0 for '%s'", s.Name)
	}
	return nil
}

// IsSuccess returns true if the skill executed successfully.
func (r *SkillResult) IsSuccess() bool {
	return r.Status == SkillStatusSuccess
}

// Summary returns a human-readable one-line summary of the result with styling.
func (r *SkillResult) Summary() string {
	icon := "🚨"
	color := "\033[31m" // red
	switch r.Status {
	case SkillStatusSuccess:
		icon = "✨" // Or "🟢", but ✨ looks premium next to checks
		color = "\033[32m" // green
	case SkillStatusSkipped:
		icon = "➖"
		color = "\033[90m" // gray
	case SkillStatusRunning:
		icon = "⚡"
		color = "\033[33m" // yellow
	case SkillStatusPending:
		icon = "🗓️ "
		color = "\033[36m" // cyan
	}
	return fmt.Sprintf("%s %s%s\033[0m — %s (%dms)", icon, color, r.SkillName, r.Message, r.Duration.Milliseconds())
}
