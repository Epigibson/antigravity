package executor

import (
	"fmt"
	"sync"
	"time"

	"github.com/nexus-dev/nexus/internal/domain"
	"github.com/nexus-dev/nexus/internal/port"
)

// ParallelExecutor wraps multiple SkillExecutors and runs them concurrently.
// Implements port.SkillExecutor for the "parallel" skill category.
// When the "Parallel Switch" skill is enabled, the Orchestrator uses this
// executor to fan-out all other skills across goroutines.
type ParallelExecutor struct {
	executors map[string]port.SkillExecutor
}

func NewParallelExecutor(executors map[string]port.SkillExecutor) *ParallelExecutor {
	return &ParallelExecutor{executors: executors}
}

func (p *ParallelExecutor) Name() string {
	return string(domain.SkillCategoryParallel)
}

// ExecuteAll runs multiple skills concurrently and collects their results.
// maxConcurrency limits the number of goroutines (0 = unlimited).
// timeout is the global deadline for all skills.
func (p *ParallelExecutor) ExecuteAll(
	project *domain.Project,
	env *domain.EnvironmentConfig,
	skills []domain.Skill,
	maxConcurrency int,
	timeout time.Duration,
) []domain.SkillResult {
	if maxConcurrency <= 0 {
		maxConcurrency = 5
	}
	if timeout <= 0 {
		timeout = 60 * time.Second
	}

	results := make([]domain.SkillResult, len(skills))
	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup

	// Create a deadline channel
	deadline := time.After(timeout)
	done := make(chan struct{})

	wg.Add(len(skills))
	for i, skill := range skills {
		go func(idx int, s domain.Skill) {
			defer wg.Done()

			// Acquire semaphore slot
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-deadline:
				results[idx] = domain.SkillResult{
					SkillName: s.Name,
					Status:    domain.SkillStatusFailed,
					Message:   "Timed out waiting for execution slot",
					Duration:  0,
				}
				return
			}

			startTime := time.Now()

			executor, ok := p.executors[string(s.Category)]
			if !ok {
				results[idx] = domain.SkillResult{
					SkillName: s.Name,
					Status:    domain.SkillStatusSkipped,
					Message:   fmt.Sprintf("No executor for category '%s'", s.Category),
					Duration:  time.Since(startTime),
				}
				return
			}

			result, err := executor.Execute(project, env, &s)
			if err != nil {
				results[idx] = domain.SkillResult{
					SkillName: s.Name,
					Status:    domain.SkillStatusFailed,
					Message:   fmt.Sprintf("Parallel execution failed: %v", err),
					Duration:  time.Since(startTime),
					Error:     err,
				}
				return
			}

			result.Duration = time.Since(startTime)
			results[idx] = *result
		}(i, skill)
	}

	// Wait for completion or timeout
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// All goroutines completed
	case <-deadline:
		// Mark any still-pending results as timed out
		for i, r := range results {
			if r.SkillName == "" {
				results[i] = domain.SkillResult{
					SkillName: skills[i].Name,
					Status:    domain.SkillStatusFailed,
					Message:   fmt.Sprintf("Global timeout reached (%ds)", int(timeout.Seconds())),
					Duration:  timeout,
				}
			}
		}
	}

	return results
}

// Execute is the standard SkillExecutor interface — for the parallel skill itself,
// it simply reports that parallel mode is active. The actual fan-out is handled
// by the Orchestrator calling ExecuteAll.
func (p *ParallelExecutor) Execute(project *domain.Project, env *domain.EnvironmentConfig, skill *domain.Skill) (*domain.SkillResult, error) {
	return &domain.SkillResult{
		SkillName: skill.Name,
		Status:    domain.SkillStatusSuccess,
		Message:   "Parallel execution mode active",
		Duration:  0,
	}, nil
}

func (p *ParallelExecutor) Rollback(project *domain.Project, env *domain.EnvironmentConfig) error {
	return nil
}
