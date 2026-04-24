"use client";

import { useEffect, useState } from "react";
import {
  FolderKanban,
  ArrowRightLeft,
  Cpu,
  Plug,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Crown,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { InnovativeLoader } from "@/components/ui/innovative-loader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
  DashboardStats,
  ActivityPoint,
  RecentSwitch,
  ProjectResponse,
} from "@/lib/api";

const PLAN_LABELS: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  enterprise: { label: "Enterprise", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Crown },
  premium: { label: "Premium", color: "text-violet-400 bg-violet-400/10 border-violet-400/20", icon: Zap },
  free: { label: "Free", color: "text-muted-foreground bg-muted/50 border-border", icon: Zap },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [recent, setRecent] = useState<RecentSwitch[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [planLimits, setPlanLimits] = useState<{
    plan: string;
    limits: Record<string, unknown>;
    usage: { projects: number; members: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, a, r, p, pl] = await Promise.all([
          api.getStats(),
          api.getActivity(),
          api.getRecentSwitches(5),
          api.listProjects(),
          api.getPlanLimits(),
        ]);
        setStats(s);
        setActivity(a);
        setRecent(r);
        setProjects(p);
        setPlanLimits(pl);
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <InnovativeLoader message="Preparando Dashboard..." subMessage="Cargando métricas y actividad reciente" />;
  }

  const plan = planLimits?.plan || "free";
  const maxProjects = (planLimits?.limits?.max_projects as number) || 3;
  const maxTools = (planLimits?.limits?.max_cli_tools as number) || 5;
  const planConfig = PLAN_LABELS[plan] || PLAN_LABELS.free;
  const PlanIcon = planConfig.icon;
  const isUnlimited = maxProjects > 9999;

  const statCards = [
    {
      title: "Proyectos Activos",
      value: stats?.total_projects ?? 0,
      icon: FolderKanban,
      description: isUnlimited ? "sin límite" : `de ${maxProjects} permitidos`,
      trend: "Configurados",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Switches Hoy",
      value: stats?.switches_today ?? 0,
      icon: ArrowRightLeft,
      description: "context switches ejecutados",
      trend: "Últimas 24h",
      color: "text-teal",
      bgColor: "bg-teal/10",
    },
    {
      title: "Skills Ejecutados",
      value: stats?.skills_executed ?? 0,
      icon: Cpu,
      description: "en los últimos 7 días",
      trend: "Actividad reciente",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Tools Conectados",
      value: isUnlimited
        ? `${stats?.tools_connected ?? 0}`
        : `${stats?.tools_connected ?? 0}/${maxTools}`,
      icon: Plug,
      description: isUnlimited ? "CLI tools (ilimitados)" : "CLI tools activos",
      trend: "Estado actual",
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenido de vuelta 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Resumen de tu actividad de desarrollo y estado de herramientas.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${planConfig.color}`}
        >
          <PlanIcon className="h-3.5 w-3.5" />
          Plan {planConfig.label}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="group relative overflow-hidden glass bg-card/40 border-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {stat.description}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                <TrendingUp className="h-3 w-3" />
                {stat.trend}
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 h-[2px] w-full opacity-0 transition-opacity group-hover:opacity-100 gradient-violet" />
          </Card>
        ))}
      </div>

      {/* Plan usage bar — only for limited plans */}
      {!isUnlimited && (
        <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uso del Plan</span>
              <span className="text-xs text-muted-foreground">
                {stats?.total_projects ?? 0} / {maxProjects} proyectos
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full gradient-violet transition-all duration-500"
                style={{
                  width: `${Math.min(
                    ((stats?.total_projects ?? 0) / maxProjects) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {maxProjects - (stats?.total_projects ?? 0)} proyectos
                disponibles
              </span>
              {(stats?.total_projects ?? 0) >= maxProjects && (
                <a
                  href="/dashboard/billing"
                  className="text-xs text-primary hover:underline"
                >
                  Upgrade →
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Chart + Recent Switches */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Actividad Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart data={activity} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Switches Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin actividad reciente
              </p>
            ) : (
              recent.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  {entry.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {entry.project_name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[9px] font-mono"
                      >
                        {entry.environment}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(entry.created_at).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {entry.duration_ms != null && ` · ${entry.duration_ms}ms`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects Quick Access */}
      <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Acceso Rápido a Proyectos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {projects.map((project) => (
              <a
                key={project.id}
                href={`/dashboard/projects/${project.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5 hover:shadow-xl hover:shadow-violet-900/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {project.name.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {project.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {project.environments.length} entornos ·{" "}
                    {project.switch_count} switches
                  </div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
