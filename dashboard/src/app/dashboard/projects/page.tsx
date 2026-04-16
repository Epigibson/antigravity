"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  ArrowRightLeft,
  Clock,
  Plus,
  Loader2,
  X,
  FolderPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ProjectResponse } from "@/lib/api";

const toolIcons: Record<string, string> = {
  git: "Git",
  gh: "GitHub",
  aws: "AWS",
  supabase: "Supabase",
  vercel: "Vercel",
  mongosh: "MongoDB",
  stripe: "Stripe",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const loadProjects = useCallback(() => {
    api.listProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.createProject({
        name,
        slug: slug || slugify(name),
        description: description || undefined,
        repo_url: repoUrl || undefined,
      });
      setShowModal(false);
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
      setRepoUrl("");
      loadProjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear proyecto");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>
          <p className="mt-1 text-muted-foreground">
            Gestiona tus proyectos y sus configuraciones de entorno.
          </p>
        </div>
        <Button
          className="gap-2 gradient-violet text-white hover:opacity-90 border-0"
          onClick={() => setShowModal(true)}
        >
          <Plus className="h-4 w-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <Card className="border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <FolderPlus className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Sin proyectos aún</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Crea tu primer proyecto para empezar a gestionar tus entornos de desarrollo.
            </p>
            <Button
              className="gap-2 gradient-violet text-white hover:opacity-90 border-0"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-4 w-4" />
              Crear Primer Proyecto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Project Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const totalProfiles = project.environments.reduce(
            (acc, env) => acc + env.cli_profiles.length,
            0
          );
          const connectedProfiles = project.environments.reduce(
            (acc, env) =>
              acc +
              env.cli_profiles.filter((p) => p.status === "connected").length,
            0
          );

          return (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.slug}`}
            >
              <Card className="glass group h-full cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-900/20 hover:border-primary/40 bg-card/40">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-violet text-white font-bold text-lg shadow-lg shadow-primary/20">
                        {project.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {project.name}
                        </CardTitle>
                        <p className="text-xs font-mono text-muted-foreground">
                          {project.slug}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>

                  {/* Environments */}
                  <div className="flex flex-wrap gap-1.5">
                    {project.environments.map((env) => (
                      <Badge
                        key={env.name}
                        variant="secondary"
                        className="text-[10px] font-mono bg-background/50 border-border/50"
                      >
                        <GitBranch className="mr-1 h-3 w-3" />
                        {env.name}
                      </Badge>
                    ))}
                  </div>

                  <Separator className="bg-border/40" />

                  {/* Stats Row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      <span>{project.switch_count} switches</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {project.last_switch
                          ? new Date(project.last_switch).toLocaleDateString(
                              "es-MX",
                              { month: "short", day: "numeric" }
                            )
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-success glow-teal" />
                      <span>
                        {connectedProfiles}/{totalProfiles} tools
                      </span>
                    </div>
                  </div>

                  {/* Connected Tools */}
                  <div className="flex flex-wrap gap-1">
                    {Array.from(
                      new Set(
                        project.environments.flatMap((e) =>
                          e.cli_profiles.map((p) => p.tool)
                        )
                      )
                    ).map((tool) => (
                      <span
                        key={tool}
                        className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/30"
                      >
                        {toolIcons[tool] || tool}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Create Project Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border/50 glass bg-card/80 p-6 shadow-2xl shadow-violet-900/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-violet text-white">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Nuevo Proyecto</h2>
                <p className="text-sm text-muted-foreground">Configura los datos básicos de tu proyecto.</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Nombre del proyecto *</Label>
                <Input
                  id="project-name"
                  placeholder="Ej: Luxor Hotel System"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-slug">Slug (identificador único) *</Label>
                <Input
                  id="project-slug"
                  placeholder="luxor-hotel-system"
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
                  required
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se usa en el CLI: <code className="text-primary">nexus switch {slug || "mi-proyecto"}</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-desc">Descripción</Label>
                <Input
                  id="project-desc"
                  placeholder="Descripción breve del proyecto"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-repo">URL del repositorio</Label>
                <Input
                  id="project-repo"
                  placeholder="https://github.com/user/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="gap-2 gradient-violet text-white hover:opacity-90 border-0"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? "Creando..." : "Crear Proyecto"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
