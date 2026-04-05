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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ProjectResponse, AuditEntry } from "@/lib/api";

const toolMeta: Record<string, { label: string; color: string }> = {
  gh: { label: "GitHub", color: "text-foreground" },
  aws: { label: "AWS", color: "text-warning" },
  supabase: { label: "Supabase", color: "text-success" },
  vercel: { label: "Vercel", color: "text-foreground" },
  mongosh: { label: "MongoDB", color: "text-success" },
  docker: { label: "Docker", color: "text-blue-400" },
  kubectl: { label: "Kubernetes", color: "text-blue-400" },
  gcloud: { label: "Google Cloud", color: "text-red-400" },
  az: { label: "Azure", color: "text-blue-500" },
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

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [envName, setEnvName] = useState("");
  const [envType, setEnvType] = useState("development");
  const [gitBranch, setGitBranch] = useState("develop");

  const loadProject = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        api.getProject(slug),
        api.listAudit({ limit: 5 }),
      ]);
      setProject(p);
      setAudit(a.filter((e) => e.project_name === p.name).slice(0, 5));
    } catch (err) {
      console.error("Error loading project:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handlePreset = (preset: typeof ENV_PRESETS[number]) => {
    setEnvName(preset.value);
    setEnvType(preset.value);
    setGitBranch(preset.branch);
  };

  const handleCreateEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.createEnvironment(slug, {
        name: envName,
        environment: envType,
        git_branch: gitBranch || undefined,
      });
      setShowModal(false);
      setEnvName("");
      setEnvType("development");
      setGitBranch("develop");
      await loadProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear entorno");
    } finally {
      setCreating(false);
    }
  };

  if (loading || !project) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-violet text-white font-bold text-2xl shadow-lg shadow-primary/20">
            {project.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {project.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Repositorio
            </a>
          )}
          <Button size="sm" className="gap-2 gradient-violet text-white border-0 hover:opacity-90">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Switch Now
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="environments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="environments">Entornos</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        {/* ─── Environments Tab ─── */}
        <TabsContent value="environments" className="space-y-6">
          {/* Add environment button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-2 gradient-violet text-white border-0 hover:opacity-90"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar Entorno
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
                  Los entornos definen cómo se configura tu proyecto en cada contexto (desarrollo, staging, producción).
                  Cada entorno puede tener sus propios perfiles CLI y variables.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {ENV_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        handlePreset(preset);
                        setShowModal(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      {preset.label}
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
                    <Badge
                      variant="outline"
                      className={`${envColors[env.environment] || ""} text-xs font-mono uppercase tracking-wider`}
                    >
                      {env.name}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span className="font-mono">{env.git_branch ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      <Key className="mr-1 h-3 w-3" />
                      {env.env_var_count} variables
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                      <Copy className="h-3 w-3" />
                      Copiar CLI
                    </Button>
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
                        const meta = toolMeta[profile.tool] || {
                          label: profile.tool,
                          color: "text-foreground",
                        };
                        return (
                          <div
                            key={`${env.name}-${profile.tool}`}
                            className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold">
                              {profile.tool}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${meta.color}`}>
                                  {meta.label}
                                </span>
                                {profile.status === "connected" && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                )}
                                {profile.status === "disconnected" && (
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                )}
                                {profile.status === "expired" && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {profile.account}
                                {profile.region && ` · ${profile.region}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin perfiles CLI configurados. Usa el CLI para agregar herramientas.
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="text-xs font-mono text-primary">
                    antigravity switch {project.slug} --env {env.name}
                  </code>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ─── Skills Tab ─── */}
        <TabsContent value="skills" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {project.skills.length === 0 && (
              <Card className="border-dashed border-2 border-border/50 md:col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sin skills configurados. Los skills se agregan automáticamente al usar el CLI.
                  </p>
                </CardContent>
              </Card>
            )}
            {project.skills.map((skill) => (
              <Card
                key={skill.id}
                className={`transition-all duration-200 ${
                  skill.is_enabled ? "border-primary/20" : "opacity-60"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{skill.icon ?? "⚙️"}</span>
                      <div>
                        <CardTitle className="text-sm">{skill.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {skill.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {skill.is_premium && (
                        <Badge className="gradient-violet text-white border-0 text-[9px]">
                          PREMIUM
                        </Badge>
                      )}
                      <Badge
                        variant={skill.is_enabled ? "default" : "secondary"}
                        className="text-[9px]"
                      >
                        {skill.is_enabled ? "ACTIVO" : "OFF"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Prioridad: {skill.priority}</span>
                    <span>Categoría: {skill.category}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Activity Tab ─── */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No hay actividad registrada para este proyecto.
                </p>
              ) : (
                audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    {entry.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{entry.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.action} · {entry.environment ?? "—"} ·{" "}
                        {entry.duration_ms ?? 0}ms
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.created_at).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create Environment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-violet text-white">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Nuevo Entorno</h2>
                <p className="text-sm text-muted-foreground">Configura un entorno para {project.name}</p>
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {ENV_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    envType === preset.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateEnv} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="env-name">Nombre del entorno *</Label>
                <Input
                  id="env-name"
                  placeholder="Ej: development, staging, production"
                  value={envName}
                  onChange={(e) => setEnvName(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="env-type">Tipo</Label>
                <select
                  id="env-type"
                  value={envType}
                  onChange={(e) => setEnvType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="env-branch">Branch de Git</Label>
                <Input
                  id="env-branch"
                  placeholder="Ej: develop, main, staging"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  💡 Después de crear el entorno, usa el CLI para agregar perfiles:
                </p>
                <code className="text-[11px] text-primary font-mono">
                  antigravity profile add {project.slug} --env {envName || "dev"} --tool gh
                </code>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !envName.trim()}
                  className="gap-2 gradient-violet text-white hover:opacity-90 border-0"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? "Creando..." : "Crear Entorno"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
