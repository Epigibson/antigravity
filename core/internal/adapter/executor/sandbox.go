package executor

import (
	"fmt"
	"time"

	"github.com/nexus-dev/nexus/internal/domain"
)

type Sandbox struct{}

func NewSandbox() *Sandbox {
	return &Sandbox{}
}

func (s *Sandbox) Name() string {
	return string(domain.SkillCategorySandbox)
}

func (s *Sandbox) Execute(project *domain.Project, env *domain.EnvironmentConfig, skill *domain.Skill) (*domain.SkillResult, error) {
	startTime := time.Now()

	ttl := 60.0
	if val, ok := skill.Config["ttl_minutes"].(float64); ok {
		ttl = val
	}

	// Simulate sandbox/container provisioning
	time.Sleep(300 * time.Millisecond)

	return &domain.SkillResult{
		SkillName: skill.Name,
		Status:    domain.SkillStatusSuccess,
		Message:   fmt.Sprintf("Ephemeral sandbox provisioned (TTL: %.0f mins)", ttl),
		Duration:  time.Since(startTime),
		Actions:   []string{fmt.Sprintf("Created isolated workspace instance for %s", env.Name)},
	}, nil
}

func (s *Sandbox) Rollback(project *domain.Project, env *domain.EnvironmentConfig) error {
	return nil
}
