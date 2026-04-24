package repository

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"time"

	"github.com/nexus-dev/nexus/internal/domain"
)

// APIClient handles communication with the Nexus backend API.
type APIClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// ProjectDTO represents a project from the API.
type ProjectDTO struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	Slug         string           `json:"slug"`
	Description  string           `json:"description"`
	RepoURL      string           `json:"repo_url"`
	IsActive     bool             `json:"is_active"`
	Environments []EnvironmentDTO `json:"environments"`
	Skills       []SkillDTO       `json:"skills"`
	SwitchCount  int              `json:"switch_count"`
	CreatedAt    string           `json:"created_at"`
}

// EnvironmentDTO represents an environment from the API.
type EnvironmentDTO struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Environment string            `json:"environment"`
	GitBranch   string            `json:"git_branch"`
	EnvVarCount int               `json:"env_var_count"`
	EnvVars     map[string]string `json:"env_vars"`
	CLIProfiles []CLIProfileDTO   `json:"cli_profiles"`
	Hooks       []HookDTO         `json:"hooks"`
}

// CLIProfileDTO represents a CLI profile from the API.
type CLIProfileDTO struct {
	Tool    string            `json:"tool"`
	Account string            `json:"account"`
	Region  string            `json:"region,omitempty"`
	Org     string            `json:"org,omitempty"`
	Status  string            `json:"status"`
	Extra   map[string]string `json:"extra,omitempty"`
}

// SkillDTO represents a skill configuration from the API.
type SkillDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Icon        string `json:"icon"`
	IsEnabled   bool   `json:"is_enabled"`
	Priority    int    `json:"priority"`
	IsPremium   bool   `json:"is_premium"`
}

// HookDTO represents a script hook from the API.
type HookDTO struct {
	Name    string `json:"name"`
	Command string `json:"command"`
	Phase   string `json:"phase"`
	Timeout int    `json:"timeout"`
}

// UserDTO represents the current user.
type UserDTO struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Plan        string `json:"plan"`
}

// AuditEntryDTO for pushing audit logs.
type AuditEntryDTO struct {
	Action      string `json:"action"`
	ProjectName string `json:"project_name"`
	Environment string `json:"environment"`
	Message     string `json:"message"`
	Success     bool   `json:"success"`
	DurationMs  int64  `json:"duration_ms"`
}

// NewAPIClient creates a client configured with API key from credentials file.
func NewAPIClient(baseURL string) *APIClient {
	apiKey := loadAPIKey()
	return &APIClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NewAPIClientWithKey creates a client with an explicit API key.
func NewAPIClientWithKey(baseURL, apiKey string) *APIClient {
	return &APIClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// IsAuthenticated returns true if an API key is configured.
func (c *APIClient) IsAuthenticated() bool {
	return c.apiKey != ""
}

// GetProfile fetches the current user profile.
func (c *APIClient) GetProfile() (*UserDTO, error) {
	var user UserDTO
	if err := c.get("/auth/me", &user); err != nil {
		return nil, err
	}
	return &user, nil
}

// ListProjects fetches all projects from the API.
func (c *APIClient) ListProjects() ([]ProjectDTO, error) {
	var projects []ProjectDTO
	if err := c.get("/projects/", &projects); err != nil {
		return nil, err
	}
	return projects, nil
}

// GetProject fetches a single project by slug with unmasked env vars for CLI use.
func (c *APIClient) GetProject(slug string) (*ProjectDTO, error) {
	var project ProjectDTO
	if err := c.get(fmt.Sprintf("/projects/%s/cli-context", slug), &project); err != nil {
		return nil, err
	}
	return &project, nil
}

// ─── HTTP helpers ───

func (c *APIClient) get(path string, result interface{}) error {
	req, err := http.NewRequest("GET", c.baseURL+"/api/v1"+path, nil)
	if err != nil {
		return err
	}
	return c.doRequest(req, result)
}

func (c *APIClient) post(path string, body interface{}, result interface{}) error {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", c.baseURL+"/api/v1"+path, bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.doRequest(req, result)
}

func (c *APIClient) doRequest(req *http.Request, result interface{}) error {
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == 401 {
		return fmt.Errorf("authentication failed — run 'nexus login' to set your API key")
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

// PushAudit sends an audit log entry to the API.
func (c *APIClient) PushAudit(entry AuditEntryDTO) error {
	return c.post("/audit/", entry, nil)
}

// Log implements port.AuditLogger for the API Client
func (c *APIClient) Log(entry domain.AuditEntry) error {
	return c.PushAudit(AuditEntryDTO{
		Action:      string(entry.Action),
		ProjectName: entry.ProjectName,
		Environment: entry.Environment,
		Message:     entry.Message,
		Success:     entry.Success,
		DurationMs:  entry.DurationMs,
	})
}

// GetLogs is currently unsupported natively via APIClient since the dashboard handles reading.
func (c *APIClient) GetLogs(projectName string, limit int) ([]domain.AuditEntry, error) {
	return nil, fmt.Errorf("GetLogs is not implemented on the API client")
}

// ─── Credentials file management (encrypted at rest) ───

const credentialsFile = "credentials"

// SaveAPIKey encrypts and persists the API key to ~/.nexus/credentials.
func SaveAPIKey(apiKey string) error {
	dir := getConfigDir()
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	path := filepath.Join(dir, credentialsFile)

	key := deriveCredentialKey()
	encrypted, err := encryptAESGCM(key, []byte(apiKey))
	if err != nil {
		// Fallback: save plaintext if encryption fails (shouldn't happen)
		return os.WriteFile(path, []byte(apiKey), 0600)
	}

	// Store as hex-encoded string with a magic prefix to identify encrypted format
	encoded := "nexus_enc_v1:" + hex.EncodeToString(encrypted)
	return os.WriteFile(path, []byte(encoded), 0600)
}

// loadAPIKey reads and decrypts the API key from ~/.nexus/credentials.
// Backward-compatible: reads plaintext credentials from old installations.
func loadAPIKey() string {
	path := filepath.Join(getConfigDir(), credentialsFile)
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}

	content := strings.TrimSpace(string(data))

	// Check if encrypted (v1 format)
	if strings.HasPrefix(content, "nexus_enc_v1:") {
		hexData := strings.TrimPrefix(content, "nexus_enc_v1:")
		ciphertext, err := hex.DecodeString(hexData)
		if err != nil {
			return ""
		}
		key := deriveCredentialKey()
		plaintext, err := decryptAESGCM(key, ciphertext)
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(plaintext))
	}

	// Backward compatibility: plaintext credential from older version.
	// Auto-upgrade to encrypted format on next save.
	return content
}

// ClearAPIKey removes the stored credentials.
func ClearAPIKey() error {
	path := filepath.Join(getConfigDir(), credentialsFile)
	return os.Remove(path)
}

func getConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".nexus")
}

// ─── Credential encryption helpers (AES-256-GCM) ───

// deriveCredentialKey creates a 32-byte AES key from machine identity.
// This prevents casual theft of the API key from the filesystem.
func deriveCredentialKey() []byte {
	hostname, _ := os.Hostname()
	username := "nexus"
	if u, err := user.Current(); err == nil {
		username = u.Username
	}
	seed := fmt.Sprintf("nexus-credential-key:%s:%s", hostname, username)
	hash := sha256.Sum256([]byte(seed))
	return hash[:]
}

// encryptAESGCM encrypts plaintext with AES-256-GCM.
// Output: [12-byte nonce][ciphertext+tag]
func encryptAESGCM(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// decryptAESGCM decrypts AES-256-GCM ciphertext.
// Input: [12-byte nonce][ciphertext+tag]
func decryptAESGCM(key, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce := ciphertext[:nonceSize]
	encrypted := ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, encrypted, nil)
}

