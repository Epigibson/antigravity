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

const toolMeta: Record<string, { label: string; color: string }> = {
  gh: { label: "GitHub", color: "text-foreground" },
  aws: { label: "AWS", color: "text-warning" },
  supabase: { label: "Supabase", color: "text-success" },
  vercel: { label: "Vercel", color: "text-foreground" },
  mongosh: { label: "MongoDB", color: "text-success" },
  docker: { label: "Docker", color: "text-blue-400" },
  kubectl: { label: "Kubernetes", color: "text-blue-400" },
  gcloud: { label: "Google Cloud", color: "text-red-400" },
  railway: { label: "Railway", color: "text-purple-400" },
};

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

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Env modal state
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envModalMode, setEnvModalMode] = useState<ModalMode>("create");
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState("");
  const [envName, setEnvName] = useState("");
  const [envOrigName, setEnvOrigName] = useState("");
  const [envType, setEnvType] = useState("development");
  const [gitBranch, setGitBranch] = useState("develop");

  // Skills
  const [skillCatalog, setSkillCatalog] = useState<SkillResponse[]>([]);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);

  // Delete confirm
  const [deletingEnv, setDeletingEnv] = useState<string | null>(null);

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

  const openCreateModal = (preset?: typeof ENV_PRESETS[number]) => {
    setEnvModalMode("create");
    setEnvName(preset?.value || "");
    setEnvType(preset?.value || "development");
    setGitBranch(preset?.branch || "develop");
    setEnvError("");
    setShowEnvModal(true);
  };

  const openEditModal = (env: ProjectResponse["environments"][number]) => {
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
        await api.createEnvironment(slug, {
          name: envName,
          environment: envType,
          git_branch: gitBranch || undefined,
        });
      } else {
        await api.updateEnvironment(slug, envOrigName, {
          git_branch: gitBranch || undefined,
        });
      }
      setShowEnvModal(false);
      await loadProject();
    } catch (err: unknown) {
      setEnvError(err instanceof Error ? err.message : "Error");
    } finally {
      setEnvSaving(false);
    }
  };

  const handleDeleteEnv = async (envName: string) => {
    try {
      await api.deleteEnvironment(slug, envName);
      setDeletingEnv(null);
      await loadProject();
    } catch (err) {
      console.error("Error deleting env:", err);
    }
  };

  const handleToggleSkill = async (skillId: string, currentEnabled: boolean) => {
    setTogglingSkill(skillId);
    try {
      await api.toggleSkill(slug, skillId, !currentEnabled);
      await loadProject();
    } catch (err) {
      console.error("Error toggling skill:", err);
    } finally {
      setTogglingSkill(null);
    }
  };

  if (loading || !project) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Merge catalog with project skills
  const projectSkillIds = new Set(project.skills.map((s) => s.id));
  const mergedSkills = skillCatalog.map((catalogSkill) => {
    const projectSkill = project.skills.find((s) => s.id === catalogSkill.id);
    return {
      ...catalogSkill,
      is_enabled: projectSkill?.is_enabled ?? false,
      priority: projectSkill?.priority ?? 10,
      is_attached: projectSkillIds.has(catalogSkill.id),
    };
  });

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

      {/* Tabs */}
      <Tabs defaultValue="environments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="environments">Entornos ({project.environments.length})</TabsTrigger>
          <TabsTrigger value="skills">Skills ({project.skills.length})</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        {/* ─── Environments Tab ─── */}
        <TabsContent value="environments" className="space-y-6">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2 gradient-violet text-white border-0 hover:opacity-90"
                    onClick={() => openCreateModal()}>
              <Plus className="h-4 w-4" /> Agregar Entorno
            </Button>
          </div>

          {project.environments.length === 0 && (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <Server className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Sin entornos configurados</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  Cada entorno define cómo se configura tu proyecto en cada contexto.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {ENV_PRESETS.map((p) => (
                    <Button key={p.value} variant="outline" size="sm" className="gap-2"
                            onClick={() => openCreateModal(p)}>
                      <Plus className="h-3 w-3" /> {p.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {project.environments.map((env) => (
            <Card key={env.name} className="overflow-hidden group">
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      <Key className="mr-1 h-3 w-3" /> {env.env_var_count} vars
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
                            onClick={() => openEditModal(env)}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    {deletingEnv === env.name ? (
                      <div className="flex items-center gap-1">
                        <Button variant="destructive" size="sm" className="h-7 text-xs"
                                onClick={() => handleDeleteEnv(env.name)}>
                          Confirmar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                                onClick={() => setDeletingEnv(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm"
                              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                              onClick={() => setDeletingEnv(env.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {env.cli_profiles.length > 0 ? (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                      Perfiles CLI
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {env.cli_profiles.map((profile) => {
                        const meta = toolMeta[profile.tool] || { label: profile.tool, color: "text-foreground" };
                        return (
                          <div key={`${env.name}-${profile.tool}`}
                               className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold">
                              {profile.tool}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                                {profile.status === "connected" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                                {profile.status === "disconnected" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                                {profile.status === "expired" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {profile.account}{profile.region && ` · ${profile.region}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin perfiles CLI. Usa el CLI para agregar herramientas.
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="text-xs font-mono text-primary">
                    antigravity switch {project.slug} --env {env.name}
                  </code>
                  <button className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => navigator.clipboard.writeText(`antigravity switch ${project.slug} --env ${env.name}`)}>
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ─── Skills Tab ─── */}
        <TabsContent value="skills" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Skills del Proyecto</h2>
              <p className="text-sm text-muted-foreground">
                Activa o desactiva módulos que potencian tu flujo de trabajo.
              </p>
            </div>
          </div>

          {mergedSkills.length === 0 ? (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-8 w-8 text-primary mb-3" />
                <p className="text-sm text-muted-foreground">
                  No hay skills en el catálogo aún.
                </p>
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
                        {skill.is_premium && (
                          <Badge className="gradient-violet text-white border-0 text-[9px]">PRO</Badge>
                        )}
                        <Switch
                          checked={skill.is_enabled}
                          disabled={togglingSkill === skill.id}
                          onCheckedChange={() => handleToggleSkill(skill.id, skill.is_enabled)}
                        />
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

        {/* ─── Activity Tab ─── */}
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
                    {entry.success
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
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

      {/* ── Env Modal (Create/Edit) ── */}
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
                <Input id="env-branch" placeholder="develop, main, staging" value={gitBranch}
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
                  {envSaving ? "Guardando..." : envModalMode === "create" ? "Crear Entorno" : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
