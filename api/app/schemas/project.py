"""Project schemas."""

from pydantic import BaseModel, Field


class CLIProfileSchema(BaseModel):
    tool: str = Field(..., examples=["gh"])
    account: str = Field(..., examples=["dev-personal"])
    org: str | None = None
    region: str | None = None
    extra: dict[str, str] | None = None
    status: str = Field(default="connected", examples=["connected"])


class ScriptHookSchema(BaseModel):
    name: str = Field(..., examples=["Run migrations"])
    command: str = Field(..., examples=["npm run migrate"])
    phase: str = Field(default="post", examples=["pre", "post"])
    timeout: int = Field(default=30, examples=[30])


class EnvironmentSchema(BaseModel):
    id: str
    name: str
    environment: str
    git_branch: str | None
    env_var_count: int = 0
    env_var_keys: list[str] = []  # just the keys, for display
    env_vars: dict[str, str] = {}  # full key-value pairs
    cli_profiles: list[CLIProfileSchema] = []
    hooks: list[ScriptHookSchema] = []

    model_config = {"from_attributes": True}


class SkillSchema(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str | None
    is_enabled: bool = True
    priority: int = 10
    is_premium: bool = False

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    repo_url: str | None
    is_active: bool
    environments: list[EnvironmentSchema] = []
    skills: list[SkillSchema] = []
    switch_count: int = 0
    last_switch: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["SaaS Platform"])
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$", examples=["saas-platform"])
    description: str | None = Field(None, max_length=500)
    repo_url: str | None = Field(None, max_length=500)


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=500)
    repo_url: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class EnvironmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["development"])
    environment: str = Field(default="development", examples=["development"])
    git_branch: str | None = Field(None, examples=["develop"])
    env_vars: dict[str, str] = Field(default_factory=dict)
    cli_profiles: list[CLIProfileSchema] = Field(default_factory=list)
    hooks: list[ScriptHookSchema] = Field(default_factory=list)


class EnvironmentUpdate(BaseModel):
    git_branch: str | None = None
    env_vars: dict[str, str] | None = None
    cli_profiles: list[CLIProfileSchema] | None = None
    hooks: list[ScriptHookSchema] | None = None
