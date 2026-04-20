package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nexus-dev/nexus/internal/domain"
)

// getStatePath returns the absolute path to the global state file.
func getStatePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}
	return filepath.Join(home, ".nexus", "state.json"), nil
}

// SaveActiveState writes the current active state to the global JSON file.
func SaveActiveState(state domain.ActiveState) error {
	path, err := getStatePath()
	if err != nil {
		return err
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("cannot create state directory: %w", err)
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write state file: %w", err)
	}

	return nil
}

// LoadActiveState reads the current active state from the global JSON file.
// Returns an error if the file doesn't exist or is invalid.
func LoadActiveState() (*domain.ActiveState, error) {
	path, err := getStatePath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err // Returns standard os.IsNotExist errors
	}

	var state domain.ActiveState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to parse state file: %w", err)
	}

	return &state, nil
}
