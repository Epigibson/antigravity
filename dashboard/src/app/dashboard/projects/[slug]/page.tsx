"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  GitBranch,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Terminal,
  ExternalLink,
  Copy,
  Loader2,
  Plus,
  X,
  Server,
  Pencil,
  Trash2,
  Zap,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { ProjectResponse, AuditEntry, SkillResponse } from "@/lib/api";

/* ─── Tool definitions ─── */
const TOOL_CATALOG = [
  { id: "gh", label: "GitHub", icon: "🐙", fields: ["account", "org"] },
  { id: "aws", label: "AWS", icon: "☁️", fields: ["account", "region"] },
  { id: "supabase", label: "Supabase", icon: "⚡", fields: ["account", "region"] },
  { id: "vercel", label: "Vercel", icon: "▲", fields: ["account", "org"] },
  { id: "railway", label: "Railway", icon: "🚂", fields: ["account"] },
  { id: "docker", label: "Docker", icon: "🐳", fields: ["account"] },
  { id: "gcloud", label: "Google Cloud", icon: "🌐", fields: ["account", "region"] },
  { id: "az", label: "Azure", icon: "🔷", fields: ["account", "region"] },
  { id: "kubectl", label: "Kubernetes", icon: "☸️", fields: ["account", "region"] },
  { id: "mongosh", label: "MongoDB", icon: "🍃", fields: ["account", "region"] },
  { id: "firebase", label: "Firebase", icon: "🔥", fields: ["account"] },
  { id: "fly", label: "Fly.io", icon: "✈️", fields: ["account", "org"] },
];

const toolMeta: Record<string, { label: string; icon: string }> = {};
TOOL_CATALOG.forEach((t) => { toolMeta[t.id] = { label: t.label, icon: t.icon }; });

const envColors: Record<string, string> = {
  development: "border-success/40 bg-success/5 text-success",
  staging: "border-warning/40 bg-warning/5 text-warning",
  production: "border-destructive/40 bg-destructive/5 text-destructive",
};

const ENV_PRESETS = [
  { label: "Development", value: "development", branch: "develop" },
  { label: "Staging", value: "staging", branch: "staging" },
  { label: "Production", value: "production", branch: "main" },
];

type ModalMode = "create" | "edit";
type CLIProfile = { tool: string; account: string; org?: string; region?: string; status?: string };

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Env modal
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envModalMode, setEnvModalMode] = useState<ModalMode>("create");
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState("");
  const [envName, setEnvName] = useState("");
  const [envOrigName, setEnvOrigName] = useState("");
  const [envType, setEnvType] = useState("development");
  const [gitBranch, setGitBranch] = useState("develop");

  // Profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileEnvName, setProfileEnvName] = useState("");
  const [profileTool, setProfileTool] = useState("");
  const [profileAccount, setProfileAccount] = useState("");
  const [profileOrg, setProfileOrg] = useState("");
  const [profileRegion, setProfileRegion] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileEditIndex, setProfileEditIndex] = useState<number | null>(null);

  // Skills
  const [skillCatalog, setSkillCatalog] = useState<SkillResponse[]>([]);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);

  // Delete confirm
  const [deletingEnv, setDeletingEnv] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const [p, a, skills] = await Promise.all([
        api.getProject(slug),
        api.listAudit({ limit: 5 }),
        api.getSkillCatalog(),
      ]);
      setProject(p);
      setAudit(a.filter((e) => e.project_name === p.name).slice(0, 5));
      setSkillCatalog(skills);
    } catch (err) {
      console.error("Error loading project:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadProject(); }, [loadProject]);

  /* ── Env Modal helpers ── */
  const openCreateEnvModal = (preset?: typeof ENV_PRESETS[number]) => {
    setEnvModalMode("create");
    setEnvName(preset?.value || "");
    setEnvType(preset?.value || "development");
    setGitBranch(preset?.branch || "develop");
    setEnvError("");
    setShowEnvModal(true);
  };

  const openEditEnvModal = (env: ProjectResponse["environments"][number]) => {
    setEnvModalMode("edit");
    setEnvName(env.name);
    setEnvOrigName(env.name);
    setEnvType(env.environment);
    setGitBranch(env.git_branch || "");
    setEnvError("");
    setShowEnvModal(true);
  };

  const handleEnvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvError("");
    setEnvSaving(true);
    try {
      if (envModalMode === "create") {
        await api.createEnvironment(slug, { name: envName, environment: envType, git_branch: gitBranch || undefined });
      } else {
        await api.updateEnvironment(slug, envOrigName, { git_branch: gitBranch || undefined });
      }
      setShowEnvModal(false);
      await loadProject();
    } catch (err: unknown) {
      setEnvError(err instanceof Error ? err.message : "Error");
    } finally {
      setEnvSaving(false);
    }
  };

  const handleDeleteEnv = async (name: string) => {
    try { await api.deleteEnvironment(slug, name); setDeletingEnv(null); await loadProject(); }
    catch (err) { console.error(err); }
  };

  /* ── Profile Modal helpers ── */
  const openAddProfile = (envName: string) => {
    setProfileEnvName(envName);
    setProfileTool("");
    setProfileAccount("");
    setProfileOrg("");
    setProfileRegion("");
    setProfileEditIndex(null);
    setProfileError("");
    setShowProfileModal(true);
  };

  const openEditProfile = (envName: string, profile: CLIProfile, index: number) => {
    setProfileEnvName(envName);
    setProfileTool(profile.tool);
    setProfileAccount(profile.account);
    setProfileOrg(profile.org || "");
    setProfileRegion(profile.region || "");
    setProfileEditIndex(index);
    setProfileError("");
    setShowProfileModal(true);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSaving(true);

    try {
      const env = project?.environments.find((e) => e.name === profileEnvName);
      if (!env) throw new Error("Entorno no encontrado");

      const newProfile: CLIProfile = {
        tool: profileTool,
        account: profileAccount,
        ...(profileOrg && { org: profileOrg }),
        ...(profileRegion && { region: profileRegion }),
        status: "connected",
      };

      let updatedProfiles: CLIProfile[];
      if (profileEditIndex !== null) {
        updatedProfiles = [...env.cli_profiles];
        updatedProfiles[profileEditIndex] = newProfile;
      } else {
        // Check for duplicate tool
        if (env.cli_profiles.some((p) => p.tool === profileTool)) {
          throw new Error(`Ya existe un perfil para ${toolMeta[profileTool]?.label || profileTool}. Edítalo en vez de crear uno nuevo.`);
        }
        updatedProfiles = [...env.cli_profiles, newProfile];
      }

      await api.updateEnvironment(slug, profileEnvName, { cli_profiles: updatedProfiles });
      setShowProfileModal(false);
      await loadProject();
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteProfile = async (envName: string, index: number) => {
    const env = project?.environments.find((e) => e.name === envName);
    if (!env) return;
    const updatedProfiles = env.cli_profiles.filter((_, i) => i !== index);
    await api.updateEnvironment(slug, envName, { cli_profiles: updatedProfiles });
    await loadProject();
  };

  /* ── Skills ── */
  const handleToggleSkill = async (skillId: string, currentEnabled: boolean) => {
    setTogglingSkill(skillId);
    try { await api.toggleSkill(slug, skillId, !currentEnabled); await loadProject(); }
    catch (err) { console.error(err); }
    finally { setTogglingSkill(null); }
  };

  /* ── Copy ── */
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading || !project) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Merge skills catalog with project skills
  const mergedSkills = skillCatalog.map((s) => {
    const ps = project.skills.find((ps) => ps.id === s.id);
    return { ...s, is_enabled: ps?.is_enabled ?? false, priority: ps?.priority ?? 10 };
  });

  const selectedToolDef = TOOL_CATALOG.find((t) => t.id === profileTool);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-violet text-white font-bold text-2xl shadow-lg shadow-primary/20">
            {project.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.repo_url && (
            <a href={project.repo_url} target="_blank" rel="noopener"
               className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
              <ExternalLink className="h-3.5 w-3.5" /> Repositorio
            </a>
          )}
          <Button size="sm" className="gap-2 gradient-violet text-white border-0 hover:opacity-90">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Switch Now
          </Button>
        </div>
      </div>

      <Tabs defaultValue="environments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="environments">Entornos ({project.environments.length})</TabsTrigger>
          <TabsTrigger value="skills">Skills ({project.skills.length})</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        {/* ═══ Environments Tab ═══ */}
        <TabsContent value="environments" className="space-y-6">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2 gradient-violet text-white border-0 hover:opacity-90"
                    onClick={() => openCreateEnvModal()}>
              <Plus className="h-4 w-4" /> Agregar Entorno
            </Button>
          </div>

          {/* Empty state */}
          {project.environments.length === 0 && (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <Server className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Sin entornos configurados</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  Cada entorno define qué cuentas y perfiles CLI usar.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {ENV_PRESETS.map((p) => (
                    <Button key={p.value} variant="outline" size="sm" className="gap-2"
                            onClick={() => openCreateEnvModal(p)}>
                      <Plus className="h-3 w-3" /> {p.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Environment cards */}
          {project.environments.map((env) => (
            <Card key={env.name} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline"
                           className={`${envColors[env.environment] || ""} text-xs font-mono uppercase tracking-wider`}>
                      {env.name}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span className="font-mono">{env.git_branch ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
                            onClick={() => openEditEnvModal(env)}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    {deletingEnv === env.name ? (
                      <div className="flex items-center gap-1">
                        <Button variant="destructive" size="sm" className="h-7 text-xs"
                                onClick={() => handleDeleteEnv(env.name)}>Sí, eliminar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={() => setDeletingEnv(null)}>No</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => setDeletingEnv(env.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* CLI Profiles */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Perfiles CLI ({env.cli_profiles.length})
                  </div>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                          onClick={() => openAddProfile(env.name)}>
                    <Plus className="h-3 w-3" /> Agregar Herramienta
                  </Button>
                </div>

                {env.cli_profiles.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-border/40 p-6 text-center">
                    <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Agrega tus herramientas CLI para este entorno
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {TOOL_CATALOG.slice(0, 6).map((tool) => (
                        <button key={tool.id}
                                onClick={() => { openAddProfile(env.name); setProfileTool(tool.id); }}
                                className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors flex items-center gap-1.5">
                          <span>{tool.icon}</span> {tool.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {env.cli_profiles.map((profile, idx) => {
                      const meta = toolMeta[profile.tool] || { label: profile.tool, icon: "🔧" };
                      return (
                        <div key={`${env.name}-${profile.tool}`}
                             className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors group/profile">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{meta.label}</span>
                              {profile.status === "connected" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                              {profile.status === "disconnected" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                              {profile.status === "expired" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {profile.account}
                              {profile.org && ` · ${profile.org}`}
                              {profile.region && ` · ${profile.region}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/profile:opacity-100 transition-opacity">
                            <button onClick={() => openEditProfile(env.name, profile, idx)}
                                    className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleDeleteProfile(env.name, idx)}
                                    className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CLI command */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <code className="text-xs font-mono text-primary flex-1">
                    antigravity switch {project.slug} --env {env.name}
                  </code>
                  <button onClick={() => copyToClipboard(`antigravity switch ${project.slug} --env ${env.name}`, env.name)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    {copied === env.name
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ═══ Skills Tab ═══ */}
        <TabsContent value="skills" className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Skills del Proyecto</h2>
            <p className="text-sm text-muted-foreground">
              Activa o desactiva módulos que potencian tu flujo de trabajo.
            </p>
          </div>

          {mergedSkills.length === 0 ? (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-8 w-8 text-primary mb-3" />
                <p className="text-sm text-muted-foreground">No hay skills en el catálogo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mergedSkills.map((skill) => (
                <Card key={skill.id}
                      className={`transition-all duration-200 ${skill.is_enabled ? "border-primary/20 shadow-sm shadow-primary/5" : "opacity-70"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{skill.icon ?? "⚙️"}</span>
                        <div>
                          <CardTitle className="text-sm">{skill.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">{skill.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {skill.is_premium && <Badge className="gradient-violet text-white border-0 text-[9px]">PRO</Badge>}
                        <Switch checked={skill.is_enabled} disabled={togglingSkill === skill.id}
                                onCheckedChange={() => handleToggleSkill(skill.id, skill.is_enabled)} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="capitalize">{skill.category.replace("-", " ")}</span>
                      {skill.is_enabled && (
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Activo
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Activity Tab ═══ */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Actividad Reciente</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No hay actividad registrada para este proyecto.
                </p>
              ) : (
                audit.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    {entry.success ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                                   : <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{entry.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.action} · {entry.environment ?? "—"} · {entry.duration_ms ?? 0}ms
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ Env Create/Edit Modal ═══ */}
      {showEnvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEnvModal(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowEnvModal(false)}
                    className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-violet text-white">
                {envModalMode === "create" ? <Server className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {envModalMode === "create" ? "Nuevo Entorno" : `Editar "${envOrigName}"`}
                </h2>
                <p className="text-sm text-muted-foreground">{project.name}</p>
              </div>
            </div>

            {envModalMode === "create" && (
              <div className="flex flex-wrap gap-2 mb-4">
                {ENV_PRESETS.map((p) => (
                  <button key={p.value} type="button"
                          onClick={() => { setEnvName(p.value); setEnvType(p.value); setGitBranch(p.branch); }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            envType === p.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                          }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleEnvSubmit} className="space-y-4">
              {envModalMode === "create" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="env-name">Nombre *</Label>
                    <Input id="env-name" placeholder="development" value={envName}
                           onChange={(e) => setEnvName(e.target.value)} required className="font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="env-type">Tipo</Label>
                    <select id="env-type" value={envType} onChange={(e) => setEnvType(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="development">Development</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="env-branch">Branch de Git</Label>
                <Input id="env-branch" placeholder="develop, main" value={gitBranch}
                       onChange={(e) => setGitBranch(e.target.value)} className="font-mono text-sm" />
              </div>
              {envError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {envError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEnvModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={envSaving || (envModalMode === "create" && !envName.trim())}
                        className="gap-2 gradient-violet text-white hover:opacity-90 border-0">
                  {envSaving ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    envModalMode === "create" ? <Plus className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {envSaving ? "Guardando..." : envModalMode === "create" ? "Crear Entorno" : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Profile Add/Edit Modal ═══ */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowProfileModal(false)}
                    className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-violet text-white text-lg">
                {profileTool ? (toolMeta[profileTool]?.icon || "🔧") : "🛠️"}
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {profileEditIndex !== null ? "Editar Herramienta" : "Agregar Herramienta"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Entorno: <span className="font-mono text-foreground">{profileEnvName}</span>
                </p>
              </div>
            </div>

            {/* Tool selector grid */}
            {profileEditIndex === null && (
              <div className="mb-4">
                <Label className="mb-2 block">Selecciona herramienta *</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {TOOL_CATALOG.map((tool) => (
                    <button key={tool.id} type="button"
                            onClick={() => setProfileTool(tool.id)}
                            className={`rounded-lg border p-2 text-center transition-all ${
                              profileTool === tool.id
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30 scale-[1.02]"
                                : "border-border hover:bg-muted"
                            }`}>
                      <div className="text-lg mb-0.5">{tool.icon}</div>
                      <div className="text-[10px] font-medium leading-tight">{tool.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {profileTool && (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-account">
                    {profileTool === "gh" ? "Usuario / Organización de GitHub" :
                     profileTool === "aws" ? "AWS Profile Name" :
                     profileTool === "supabase" ? "Project Reference" :
                     "Cuenta / Identificador"} *
                  </Label>
                  <Input id="profile-account"
                         placeholder={
                           profileTool === "gh" ? "epigibson" :
                           profileTool === "aws" ? "luxor-prod" :
                           profileTool === "supabase" ? "abcdefghijk" :
                           profileTool === "vercel" ? "my-team" :
                           "account-name"
                         }
                         value={profileAccount}
                         onChange={(e) => setProfileAccount(e.target.value)}
                         required className="font-mono text-sm" />
                </div>

                {selectedToolDef?.fields.includes("org") && (
                  <div className="space-y-2">
                    <Label htmlFor="profile-org">Organización</Label>
                    <Input id="profile-org" placeholder="mi-empresa"
                           value={profileOrg} onChange={(e) => setProfileOrg(e.target.value)}
                           className="font-mono text-sm" />
                  </div>
                )}

                {selectedToolDef?.fields.includes("region") && (
                  <div className="space-y-2">
                    <Label htmlFor="profile-region">Región</Label>
                    <Input id="profile-region"
                           placeholder={
                             profileTool === "aws" ? "us-east-1" :
                             profileTool === "gcloud" ? "us-central1" :
                             "region"
                           }
                           value={profileRegion} onChange={(e) => setProfileRegion(e.target.value)}
                           className="font-mono text-sm" />
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    ⚡ Esto le dice a <strong>antigravity switch</strong> qué perfil activar para{" "}
                    <strong>{toolMeta[profileTool]?.label}</strong> cuando cambies a este entorno.
                  </p>
                  {profileTool === "gh" && (
                    <p className="text-[11px] text-muted-foreground">
                      Equivale a: <code className="text-primary">gh auth switch --user {profileAccount || "…"}</code>
                    </p>
                  )}
                  {profileTool === "aws" && (
                    <p className="text-[11px] text-muted-foreground">
                      Equivale a: <code className="text-primary">export AWS_PROFILE={profileAccount || "…"}</code>
                    </p>
                  )}
                </div>

                {profileError && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    {profileError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowProfileModal(false)}>Cancelar</Button>
                  <Button type="submit" disabled={profileSaving || !profileAccount.trim()}
                          className="gap-2 gradient-violet text-white hover:opacity-90 border-0">
                    {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {profileSaving ? "Guardando..." : profileEditIndex !== null ? "Guardar Cambios" : "Agregar"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
