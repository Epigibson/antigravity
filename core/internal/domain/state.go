package domain

import "time"

// ActiveState represents the globally active context saved locally.
type ActiveState struct {
	ProjectName string    `json:"project_name"`
	Environment string    `json:"environment"`
	Timestamp   time.Time `json:"timestamp"`
}
