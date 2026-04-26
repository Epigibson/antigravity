package executor

import (
	"fmt"
	"time"

	"github.com/nexus-dev/nexus/internal/domain"
)

type TeamContextSync struct{}

func NewTeamContextSync() *TeamContextSync {
	return &TeamContextSync{}
}

func (t *TeamContextSync) Name() string {
	return string(domain.SkillCategoryTeamSync)
}

func (t *TeamContextSync) Execute(project *domain.Project, env *domain.EnvironmentConfig, skill *domain.Skill) (*domain.SkillResult, error) {
	startTime := time.Now()

	broadcast := true
	if val, ok := skill.Config["broadcast_on_switch"].(bool); ok {
		broadcast = val
	}

	if !broadcast {
		return &domain.SkillResult{
			SkillName: skill.Name,
			Status:    domain.SkillStatusSkipped,
			Message:   "Team broadcast disabled in project configuration",
			Duration:  time.Since(startTime),
		}, nil
	}

	// Simulate websocket/API broadcast latency
	time.Sleep(100 * time.Millisecond)

	return &domain.SkillResult{
		SkillName: skill.Name,
		Status:    domain.SkillStatusSuccess,
		Message:   "Context shift broadcasted to team members",
		Duration:  time.Since(startTime),
		Actions:   []string{fmt.Sprintf("Notified organization that you switched to %s", project.Name)},
	}, nil
}

func (t *TeamContextSync) Rollback(project *domain.Project, env *domain.EnvironmentConfig) error {
	return nil
}
