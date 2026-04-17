"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SkillResponse, ProjectResponse } from "@/lib/api";
import {
  Zap,
  Loader2,
  Lock,
  Search,
  Check,
  Crown,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  "git-state": { label: "Git", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  "cli-switching": { label: "CLI", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  "context-injection": { label: "Context", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  "documentation": { label: "Docs", color: "text-pink-400 bg-pink-400/10 border-pink-400/20" },
  "sandbox": { label: "Sandbox", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
};

export default function SkillsPage() {
  const [catalog, setCatalog] = useState<SkillResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectSkills, setProjectSkills] = useState<SkillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [planLimits, setPlanLimits] = useState<{ plan: string; limits: Record<string, unknown> } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catalogData, projectsData, limitsData] = await Promise.all([
        api.getSkillCatalog(),
        api.listProjects(),
        api.getPlanLimits(),
      ]);
      setCatalog(catalogData);
      setProjects(projectsData);
      setPlanLimits(limitsData);
      if (projectsData.length > 0) {
        setSelectedProject(projectsData[0].slug);
        setProjectSkills(projectsData[0].skills || []);
      }
    } catch (err) {
      console.error("Error loading skills:", err);
    } finally {
      setLoading(false);
    }
  };

  const onProjectChange = (slug: string) => {
    setSelectedProject(slug);
    const proj = projects.find((p) => p.slug === slug);
    setProjectSkills(proj?.skills || []);
  };

  const isSkillEnabled = (skillId: string) => {
    return projectSkills.some((s) => s.id === skillId && s.is_enabled);
  };

  const handleToggle = async (skill: SkillResponse) => {
    if (!selectedProject) return;
    setToggling(skill.id);
    try {
      const newEnabled = !isSkillEnabled(skill.id);
      await api.toggleSkill(selectedProject, skill.id, newEnabled);

      // Update local state
      if (newEnabled) {
        setProjectSkills((prev) => [...prev.filter((s) => s.id !== skill.id), { ...skill, is_enabled: true }]);
      } else {
        setProjectSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, is_enabled: false } : s)));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cambiar skill");
    } finally {
      setToggling(null);
    }
  };

  const isPremiumPlan = planLimits?.plan === "premium" || planLimits?.plan === "enterprise";

  const categories = ["all", ...new Set(catalog.map((s) => s.category))];

  const filteredCatalog = catalog.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || s.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const freeSkills = filteredCatalog.filter((s) => !s.is_premium);
  const premiumSkills = filteredCatalog.filter((s) => s.is_premium);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Zap className="h-7 w-7 text-primary" />
            Skills
          </h1>
          <p className="text-muted-foreground mt-1">
            Habilita automatizaciones para tus proyectos al hacer context switch
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{catalog.length} skills disponibles</span>
          <span className="text-primary font-mono">•</span>
          <span className="text-muted-foreground">{projectSkills.filter((s) => s.is_enabled).length} activos</span>
        </div>
      </div>

      {/* Project selector + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Project selector */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedProject || ""}
            onChange={(e) => onProjectChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          >
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => {
            const config = CATEGORY_LABELS[cat] || { label: cat === "all" ? "Todos" : cat, color: "text-muted-foreground bg-muted/50 border-border" };
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  filterCategory === cat
                    ? "border-primary bg-primary/10 text-primary"
                    : `${config.color} hover:bg-muted/80`
                }`}
              >
                {cat === "all" ? "Todos" : config.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar skills..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      {/* Free skills */}
      {freeSkills.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Skills Incluidos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {freeSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                enabled={isSkillEnabled(skill.id)}
                toggling={toggling === skill.id}
                canToggle
                onToggle={() => handleToggle(skill)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Premium skills */}
      {premiumSkills.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            Skills Premium
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {premiumSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                enabled={isSkillEnabled(skill.id)}
                toggling={toggling === skill.id}
                canToggle={isPremiumPlan}
                locked={!isPremiumPlan}
                onToggle={() => handleToggle(skill)}
              />
            ))}
          </div>
        </div>
      )}

      {filteredCatalog.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No se encontraron skills</p>
        </div>
      )}
    </div>
  );
}

// ─── Skill Card Component ───

function SkillCard({
  skill,
  enabled,
  toggling,
  canToggle,
  locked,
  onToggle,
}: {
  skill: SkillResponse;
  enabled: boolean;
  toggling: boolean;
  canToggle: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  const categoryConfig = CATEGORY_LABELS[skill.category] || { label: skill.category, color: "text-muted-foreground bg-muted/50 border-border" };

  return (
    <div
      className={`group rounded-xl border p-4 transition-all duration-200 ${
        enabled
          ? "border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5"
          : locked
          ? "border-border/50 bg-card/50 opacity-70"
          : "border-border bg-card hover:border-primary/20 hover:bg-primary/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`text-2xl shrink-0 mt-0.5 ${locked ? "grayscale" : ""}`}>
          {skill.icon || "⚡"}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">{skill.name}</h3>
            {skill.is_premium && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                PRO
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {skill.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${categoryConfig.color}`}>
              {categoryConfig.label}
            </span>
            {enabled && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                Activo
              </span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <div className="shrink-0">
          {locked ? (
            <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground" title="Requiere plan Premium">
              <Lock className="h-4 w-4" />
            </div>
          ) : (
            <button
              onClick={onToggle}
              disabled={toggling || !canToggle}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                enabled ? "bg-primary" : "bg-muted-foreground/30"
              } ${toggling ? "opacity-50" : ""}`}
            >
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
              ) : (
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
