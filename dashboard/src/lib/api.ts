/**
 * Nexus API Client — Typed HTTP client with JWT auth.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : "http://localhost:8000/api/v1";

// ─── Auth helpers ───

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ag_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Token expired — redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("ag_token");
      localStorage.removeItem("ag_user");

      // Evitar bucle infinito de recargas si ya estamos en una ruta de autenticación
      const isAuthRoute = ['/login', '/', '/register'].includes(window.location.pathname);
      if (!isAuthRoute) {
        window.location.href = "/login";
      }
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // FastAPI validation errors come as detail: [{msg, loc, type}, ...]
    if (Array.isArray(body.detail)) {
      const messages = body.detail.map((e: { msg?: string; loc?: string[] }) => {
        const field = e.loc?.slice(-1)[0] || "";
        return field ? `${field}: ${e.msg}` : (e.msg || "Error de validación");
      });
      throw new Error(messages.join(". "));
    }
    throw new Error(body.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

// ─── Types (from API responses) ───

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  display_name: string | null;
}

export interface UserResponse {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  created_at: string;
}

export interface CLIProfile {
  tool: string;
  account: string;
  org?: string;
  region?: string;
  extra?: Record<string, string>;
  status: string;
}

export interface ScriptHook {
  name: string;
  command: string;
  phase: "pre" | "post";
  timeout: number;
}

export interface EnvironmentResponse {
  id: string;
  name: string;
  environment: string;
  git_branch: string | null;
  env_var_count: number;
  env_var_keys: string[];
  env_vars: Record<string, string>;
  cli_profiles: CLIProfile[];
  hooks: ScriptHook[];
}

export interface SkillResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  is_enabled: boolean;
  priority: number;
  is_premium: boolean;
}

export interface ProjectResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repo_url: string | null;
  is_active: boolean;
  environments: EnvironmentResponse[];
  skills: SkillResponse[];
  switch_count: number;
  last_switch: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_projects: number;
  switches_today: number;
  skills_executed: number;
  tools_connected: number;
}

export interface ActivityPoint {
  day: string;
  switches: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  project_name: string | null;
  environment: string | null;
  skill_name: string | null;
  message: string;
  success: boolean;
  duration_ms: number | null;
  created_at: string;
}

export interface RecentSwitch {
  id: string;
  project_name: string;
  environment: string;
  message: string;
  success: boolean;
  duration_ms: number | null;
  created_at: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiKeyCreatedResponse extends ApiKeyResponse {
  full_key: string;
}

// ─── API Methods ───

export const api = {
  // Auth
  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<TokenResponse>(res);
  },

  async register(email: string, password: string, displayName?: string): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    return handleResponse<TokenResponse>(res);
  },

  async getProfile(): Promise<UserResponse> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    return handleResponse<UserResponse>(res);
  },

  async updateProfile(data: { display_name?: string; avatar_url?: string }): Promise<UserResponse> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<UserResponse>(res);
  },

  // API Keys
  async generateApiKey(name: string = "CLI Key"): Promise<ApiKeyCreatedResponse> {
    const res = await fetch(`${API_BASE}/auth/api-keys`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse<ApiKeyCreatedResponse>(res);
  },

  async listApiKeys(): Promise<ApiKeyResponse[]> {
    const res = await fetch(`${API_BASE}/auth/api-keys`, { headers: authHeaders() });
    return handleResponse<ApiKeyResponse[]>(res);
  },

  async revokeApiKey(keyId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/api-keys/${keyId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 204) throw new Error("Error al revocar API key");
  },

  // Projects
  async listProjects(): Promise<ProjectResponse[]> {
    const res = await fetch(`${API_BASE}/projects/`, { headers: authHeaders() });
    return handleResponse<ProjectResponse[]>(res);
  },

  async getProject(slug: string): Promise<ProjectResponse> {
    const res = await fetch(`${API_BASE}/projects/${slug}`, { headers: authHeaders() });
    return handleResponse<ProjectResponse>(res);
  },

  async updateProject(slug: string, data: { name?: string; description?: string; repo_url?: string }): Promise<ProjectResponse> {
    const res = await fetch(`${API_BASE}/projects/${slug}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectResponse>(res);
  },

  async createProject(data: { name: string; slug: string; description?: string; repo_url?: string }): Promise<ProjectResponse> {
    const res = await fetch(`${API_BASE}/projects/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectResponse>(res);
  },

  async deleteProject(slug: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${slug}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error al eliminar proyecto");
  },

  // Environments
  async createEnvironment(
    projectSlug: string,
    data: {
      name: string;
      environment: string;
      git_branch?: string;
      cli_profiles?: Array<{ tool: string; account: string; org?: string; region?: string; status?: string }>;
    }
  ): Promise<unknown> {
    const res = await fetch(`${API_BASE}/projects/${projectSlug}/environments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateEnvironment(
    projectSlug: string,
    envName: string,
    data: {
      git_branch?: string;
      env_vars?: Record<string, string>;
      cli_profiles?: Array<{ tool: string; account: string; org?: string; region?: string; status?: string }>;
    }
  ): Promise<unknown> {
    const res = await fetch(`${API_BASE}/projects/${projectSlug}/environments/${envName}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteEnvironment(projectSlug: string, envName: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${projectSlug}/environments/${envName}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Error al eliminar entorno");
  },

  // Skills
  async toggleSkill(projectSlug: string, skillId: string, enabled: boolean, priority?: number): Promise<unknown> {
    const params = new URLSearchParams({ enabled: String(enabled) });
    if (priority !== undefined) params.set("priority", String(priority));
    const res = await fetch(`${API_BASE}/skills/projects/${projectSlug}/${skillId}?${params}`, {
      method: "PUT",
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  // Skills
  async getSkillCatalog(): Promise<SkillResponse[]> {
    const res = await fetch(`${API_BASE}/skills/catalog`, { headers: authHeaders() });
    return handleResponse<SkillResponse[]>(res);
  },

  // Audit
  async listAudit(params?: {
    action?: string;
    success?: boolean;
    project_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditEntry[]> {
    const query = new URLSearchParams();
    if (params?.action && params.action !== "all") query.set("action", params.action);
    if (params?.success !== undefined && params.success !== null) query.set("success", String(params.success));
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));

    const res = await fetch(`${API_BASE}/audit/?${query}`, { headers: authHeaders() });
    return handleResponse<AuditEntry[]>(res);
  },

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard/stats`, { headers: authHeaders() });
    return handleResponse<DashboardStats>(res);
  },

  async getActivity(days = 7): Promise<ActivityPoint[]> {
    const res = await fetch(`${API_BASE}/dashboard/activity?days=${days}`, { headers: authHeaders() });
    return handleResponse<ActivityPoint[]>(res);
  },

  async getRecentSwitches(limit = 10): Promise<RecentSwitch[]> {
    const res = await fetch(`${API_BASE}/dashboard/recent?limit=${limit}`, { headers: authHeaders() });
    return handleResponse<RecentSwitch[]>(res);
  },

  // Billing
  async getStripeConfig(): Promise<{ publishable_key: string }> {
    const res = await fetch(`${API_BASE}/billing/config`, { headers: authHeaders() });
    return handleResponse<{ publishable_key: string }>(res);
  },

  async createSubscription(): Promise<{ client_secret: string; subscription_id: string; customer_id: string }> {
    const res = await fetch(`${API_BASE}/billing/create-subscription`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handleResponse<{ client_secret: string; subscription_id: string; customer_id: string }>(res);
  },

  async confirmSubscription(setupIntentId: string): Promise<{ status: string; subscription_id: string }> {
    const res = await fetch(`${API_BASE}/billing/confirm-subscription`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ setup_intent_id: setupIntentId }),
    });
    return handleResponse<{ status: string; subscription_id: string }>(res);
  },

  async createCheckout(successUrl: string, cancelUrl: string): Promise<{ checkout_url: string }> {
    const res = await fetch(`${API_BASE}/billing/checkout`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
    });
    return handleResponse<{ checkout_url: string }>(res);
  },

  async createPortal(): Promise<{ portal_url: string }> {
    const res = await fetch(`${API_BASE}/billing/portal`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handleResponse<{ portal_url: string }>(res);
  },

  async getSubscription(): Promise<{
    plan: string;
    status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
  }> {
    const res = await fetch(`${API_BASE}/billing/subscription`, { headers: authHeaders() });
    return handleResponse(res);
  },

  // ─── Plan Limits ───

  async getPlanLimits(): Promise<{
    plan: string;
    limits: Record<string, unknown>;
    usage: { projects: number; members: number };
  }> {
    const res = await fetch(`${API_BASE}/billing/plan-limits`, { headers: authHeaders() });
    return handleResponse(res);
  },

  // ─── Teams ───

  async getTeamMembers(): Promise<Array<{
    user_id: string;
    email: string;
    display_name: string | null;
    role: string;
    joined_at: string;
  }>> {
    const res = await fetch(`${API_BASE}/teams/members`, { headers: authHeaders() });
    return handleResponse(res);
  },

  async inviteTeamMember(email: string, role: string = "member"): Promise<{
    user_id: string;
    email: string;
    display_name: string | null;
    role: string;
    joined_at: string;
  }> {
    const res = await fetch(`${API_BASE}/teams/members`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, role }),
    });
    return handleResponse(res);
  },

  async updateMemberRole(userId: string, role: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/teams/members/${userId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse(res);
  },

  async removeMember(userId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/teams/members/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error" }));
      throw new Error(err.detail || "Error eliminando miembro");
    }
  },
};

