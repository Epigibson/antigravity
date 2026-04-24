package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewYAMLReader(t *testing.T) {
	// Test without extra paths
	reader := NewYAMLReader()
	if reader == nil {
		t.Fatal("expected reader to not be nil")
	}
	if len(reader.searchPaths) < 3 {
		t.Fatalf("expected at least 3 default paths, got %d", len(reader.searchPaths))
	}

	// Test with extra paths
	readerWithExtra := NewYAMLReader("extra/path.yaml", "another/path.yaml")
	if len(readerWithExtra.searchPaths) != len(reader.searchPaths)+2 {
		t.Fatalf("expected extra paths to be appended")
	}
}

func TestContainsGlob(t *testing.T) {
	testCases := []struct {
		path     string
		expected bool
	}{
		{"/path/to/file.yaml", false},
		{"/path/to/*.yaml", true},
		{"/path/to/?.yaml", true},
		{"/path/to/[abc].yaml", true},
	}

	for _, tc := range testCases {
		t.Run(tc.path, func(t *testing.T) {
			if containsGlob(tc.path) != tc.expected {
				t.Fatalf("expected containsGlob(%q) to be %v", tc.path, tc.expected)
			}
		})
	}
}

const validProjectYAML = `
version: "1.0"
project:
  name: "Test Project"
  slug: "test-project"
  repo: "https://github.com/test/repo"
environments:
  development:
    name: "development"
    branch: "main"
    env:
      DB_HOST: "localhost"
    cli_profiles:
      - tool: "gh"
        account: "testuser"
skills:
  - id: "skill-1"
    name: "Skill 1"
    enabled: true
    priority: 1
`

const invalidProjectYAML = `
version: "1.0"
project:
  name: "Test Project
  slug: "test-project"
` // Missing closing quote on name

func TestReadFromFile(t *testing.T) {
	tempDir := t.TempDir()
	validPath := filepath.Join(tempDir, "valid.yaml")
	invalidPath := filepath.Join(tempDir, "invalid.yaml")

	err := os.WriteFile(validPath, []byte(validProjectYAML), 0644)
	if err != nil {
		t.Fatal(err)
	}

	err = os.WriteFile(invalidPath, []byte(invalidProjectYAML), 0644)
	if err != nil {
		t.Fatal(err)
	}

	reader := NewYAMLReader()

	// Test valid file
	project, err := reader.readFromFile(validPath)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if project == nil {
		t.Fatal("expected project to not be nil")
	}
	if project.Name != "Test Project" {
		t.Errorf("expected project name 'Test Project', got '%s'", project.Name)
	}
	if len(project.Environments) != 1 {
		t.Errorf("expected 1 environment, got %d", len(project.Environments))
	}
	if len(project.Skills) != 1 {
		t.Errorf("expected 1 skill, got %d", len(project.Skills))
	}

	// Test invalid file
	_, err = reader.readFromFile(invalidPath)
	if err == nil {
		t.Fatal("expected error reading invalid yaml")
	}

	// Test missing file
	_, err = reader.readFromFile(filepath.Join(tempDir, "missing.yaml"))
	if err == nil {
		t.Fatal("expected error reading missing yaml")
	}
}

func TestReadProject(t *testing.T) {
	tempDir := t.TempDir()
	validPath := filepath.Join(tempDir, "nexus.yaml")

	err := os.WriteFile(validPath, []byte(validProjectYAML), 0644)
	if err != nil {
		t.Fatal(err)
	}

	// Create a reader with the temp dir as a search path
	reader := NewYAMLReader(validPath)

	// Test reading specific path
	project, err := reader.ReadProject(validPath)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if project == nil {
		t.Fatal("expected project to not be nil")
	}

	// Test finding via search paths
	project, err = reader.ReadProject("")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if project == nil {
		t.Fatal("expected project to not be nil")
	}

	// Test not found
	emptyReader := NewYAMLReader() // Only default paths

	// Create a temporary directory that is guaranteed empty
	// to avoid finding a real "nexus.yaml" in the user's home directory
	emptyDir := t.TempDir()

	// Temporarily override the search paths for testing "not found"
	emptyReader.searchPaths = []string{
		filepath.Join(emptyDir, "nexus.yaml"),
		filepath.Join(emptyDir, ".nexus.yaml"),
	}

	_, err = emptyReader.ReadProject("")
	if err == nil {
		t.Fatal("expected error when no project found")
	}
}

func TestListProjects(t *testing.T) {
	tempDir := t.TempDir()

	// Create multiple valid project files
	proj1 := filepath.Join(tempDir, "proj1.yaml")
	proj2 := filepath.Join(tempDir, "proj2.yaml")

	err := os.WriteFile(proj1, []byte(validProjectYAML), 0644)
	if err != nil {
		t.Fatal(err)
	}

	// Create another slightly different project
	proj2Yaml := `
version: "1.0"
project:
  name: "Project 2"
  slug: "proj2"
  repo: "repo2"
`
	err = os.WriteFile(proj2, []byte(proj2Yaml), 0644)
	if err != nil {
		t.Fatal(err)
	}

	// Setup reader with direct files and a glob pattern
	// Clear the default paths that might find global projects
	reader := &YAMLReader{
		searchPaths: []string{
			proj1,
			filepath.Join(tempDir, "*.yaml"),
		},
	}

	projects, err := reader.ListProjects()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Should find both projects, proj1 shouldn't be duplicated even though it matches glob and direct
	if len(projects) != 2 {
		t.Fatalf("expected 2 projects, got %d", len(projects))
	}

	foundProj1 := false
	foundProj2 := false

	for _, p := range projects {
		if p.Name == "Test Project" {
			foundProj1 = true
		} else if p.Name == "Project 2" {
			foundProj2 = true
		}
	}

	if !foundProj1 || !foundProj2 {
		t.Fatal("expected to find both projects")
	}
}
