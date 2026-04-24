"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import StripeCheckoutModal from "@/components/stripe-checkout-modal";
import { InnovativeLoader } from "@/components/ui/innovative-loader";
import {
  CreditCard,
  Rocket,
  Check,
  Crown,
  Building2,
  Zap,
  ShieldCheck,
  BarChart3,
  Users,
  Loader2,
  ArrowRight,
  Sparkles,
  Terminal,
  FolderKanban,
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
import { Separator } from "@/components/ui/separator";

// ─── Plan definitions ───

const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "para siempre",
    icon: Zap,
    color: "text-muted-foreground",
    description: "Perfecto para proyectos personales y experimentación.",
    features: [
      { text: "Hasta 3 proyectos", icon: FolderKanban },
      { text: "5 CLI tools soportados", icon: Terminal },
      { text: "Skills manuales", icon: Sparkles },
      { text: "Audit log local", icon: BarChart3 },
      { text: "Soporte comunitario", icon: Users },
    ],
    limits: [
      "Sin sandboxes",
      "Sin documentación auto",
      "Sin gestión de equipos",
    ],
  },
  {
    key: "premium",
    name: "Premium",
    price: "$12",
    period: "/mes",
    icon: Rocket,
    color: "text-primary",
    popular: true,
    description: "Para desarrolladores profesionales y equipos pequeños.",
    features: [
      { text: "Proyectos ilimitados", icon: FolderKanban },
      { text: "CLI tools ilimitados", icon: Terminal },
      { text: "Skills automatizados y paralelos", icon: Sparkles },
      { text: "Script-Runners avanzados", icon: Zap },
      { text: "Gestión de equipos", icon: Users },
      { text: "Audit log en la nube", icon: BarChart3 },
      { text: "Soporte prioritario", icon: ShieldCheck },
    ],
    limits: [],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Contactar",
    period: "",
    icon: Building2,
    color: "text-amber-500",
    description: "Para organizaciones con requisitos de seguridad avanzados.",
    features: [
      { text: "Todo de Premium", icon: Rocket },
      { text: "SSO / SAML", icon: ShieldCheck },
      { text: "Compliance & auditoría", icon: BarChart3 },
      { text: "SLA garantizado", icon: Check },
      { text: "Soporte dedicado 24/7", icon: Users },
      { text: "On-premise disponible", icon: Building2 },
    ],
    limits: [],
  },
];

// ─── Usage stats component ───

function UsageBar({
  label,
  used,
  max,
  icon: Icon,
}: {
  label: string;
  used: number;
  max: number | null;
  icon: React.ElementType;
}) {
  const pct = max ? Math.min((used / max) * 100, 100) : 0;
  const isUnlimited = max === null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground">
          {used} / {isUnlimited ? "∞" : max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct > 80
              ? "bg-destructive"
              : pct > 50
              ? "bg-warning"
              : "gradient-violet"
          }`}
          style={{ width: isUnlimited ? "10%" : `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main page ───

function BillingPageContent() {
  const { user, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<{
    total_projects: number;
    tools_connected: number;
    switches_today: number;
    skills_executed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "cancelled"; text: string } | null>(null);

  const currentPlan = (user?.plan || "free").toLowerCase();

  // Handle redirect from Stripe Checkout
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setStatusMsg({ type: "success", text: "¡Pago exitoso! Tu plan se actualizará en unos segundos." });
      // Refresh profile to get updated plan
      setTimeout(() => refreshProfile(), 2000);
      setTimeout(() => setStatusMsg(null), 6000);
    } else if (status === "cancelled") {
      setStatusMsg({ type: "cancelled", text: "El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras." });
      setTimeout(() => setStatusMsg(null), 5000);
    }
  }, [searchParams, refreshProfile]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const maxProjects = currentPlan === "free" ? 3 : null;

  const handleUpgrade = () => {
    setShowCheckoutModal(true);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckoutModal(false);
    setStatusMsg({ type: "success", text: "¡Pago exitoso! Tu plan Premium está activo." });
    refreshProfile();
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      const { portal_url } = await api.createPortal();
      window.location.href = portal_url;
    } catch (err) {
      console.error("Portal error:", err);
      setStatusMsg({ type: "error", text: "Error al abrir el portal de facturación." });
      setTimeout(() => setStatusMsg(null), 4000);
    } finally {
      setManagingPortal(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Suscripción y Pagos
        </h1>
        <p className="mt-1 text-muted-foreground">
          Administra tu plan, consumo y facturación.
        </p>
      </div>

      {/* Status messages from Stripe redirect */}
      {statusMsg && (
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
            statusMsg.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
              : statusMsg.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          }`}
        >
          {statusMsg.type === "success" ? (
            <Check className="h-5 w-5" />
          ) : statusMsg.type === "error" ? (
            <CreditCard className="h-5 w-5" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
          {statusMsg.text}
        </div>
      )}

      {/* ─── Current Plan + Usage ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plan actual card */}
        <Card className="lg:col-span-1 relative overflow-hidden border-primary/30 glass bg-card/40 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="h-4 w-4 text-primary" />
                Tu Plan Actual
              </CardTitle>
              <Badge
                variant="secondary"
                className="uppercase text-[10px] font-bold tracking-wider"
              >
                {currentPlan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-4xl font-bold font-mono">
                {currentPlan === "free"
                  ? "$0"
                  : currentPlan === "premium"
                  ? "$12"
                  : "Custom"}
              </span>
              <span className="text-sm text-muted-foreground ml-1">
                {currentPlan === "free" ? "para siempre" : "/mes"}
              </span>
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <p className="font-medium">Miembro desde</p>
              <p className="text-muted-foreground">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("es-MX", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </p>
            </div>

            {currentPlan === "free" && (
              <Button
                className="w-full gap-2 gradient-violet text-white border-0 hover:opacity-90 mt-2"
                onClick={handleUpgrade}
                disabled={upgrading}
              >
                {upgrading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {upgrading ? "Redirigiendo a Stripe..." : "Upgrade a Premium"}
              </Button>
            )}
            {(currentPlan === "premium" || currentPlan === "enterprise") && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary font-medium">
                  <Check className="h-4 w-4" />
                  {currentPlan === "enterprise" ? "Plan Enterprise activo 👑" : "Estás en el mejor plan"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleManageSubscription}
                  disabled={managingPortal}
                >
                  {managingPortal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Gestionar Suscripción
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage card */}
        <Card className="lg:col-span-2 glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Consumo Actual
            </CardTitle>
            <CardDescription>
              Tu uso del período actual en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <UsageBar
                  label="Proyectos"
                  used={stats?.total_projects ?? 0}
                  max={maxProjects}
                  icon={FolderKanban}
                />
                <UsageBar
                  label="CLI Tools Conectados"
                  used={stats?.tools_connected ?? 0}
                  max={currentPlan === "free" ? 5 : null}
                  icon={Terminal}
                />
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-primary">
                      {stats?.switches_today ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Switches hoy
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-primary">
                      {stats?.skills_executed ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Skills ejecutadas
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Plan Comparison ─── */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Compara los Planes</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Elige el plan que mejor se adapte a tu flujo de trabajo.
        </p>

        <div className="grid gap-6 md:grid-cols-3 pt-4">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const PlanIcon = plan.icon;

            return (
              <Card
                key={plan.key}
                className={`relative overflow-visible glass bg-card/40 transition-all duration-300 hover:-translate-y-1 ${
                  isCurrent
                    ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                    : plan.popular
                    ? "border-primary/40 shadow-md hover:shadow-xl hover:shadow-violet-900/10"
                    : "border-border/50 hover:border-border hover:shadow-xl hover:shadow-violet-900/10"
                }`}
              >
                {/* Popular badge */}
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="gradient-violet text-white border-0 text-[10px] px-3 shadow-lg shadow-primary/30">
                      RECOMENDADO
                    </Badge>
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-primary-foreground border-0 text-[10px] px-3 shadow-lg">
                      <Check className="h-3 w-3 mr-1" />
                      TU PLAN
                    </Badge>
                  </div>
                )}

                <CardHeader className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <PlanIcon className={`h-5 w-5 ${plan.color}`} />
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <div>
                    <span className="text-3xl font-bold font-mono">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-muted-foreground ml-1">
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <CardDescription className="mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <Separator />

                  {/* Features */}
                  {plan.features.map((f) => (
                    <div
                      key={f.text}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      <f.icon className="h-4 w-4 shrink-0 text-success" />
                      <span>{f.text}</span>
                    </div>
                  ))}

                  {/* Limits */}
                  {plan.limits.map((l) => (
                    <div
                      key={l}
                      className="flex items-center gap-2.5 text-sm text-muted-foreground/60 line-through"
                    >
                      <span className="h-4 w-4 shrink-0" />
                      {l}
                    </div>
                  ))}

                  <div className="pt-2">
                    {isCurrent ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        Plan Actual
                      </Button>
                    ) : plan.key === "enterprise" ? (
                      <Button variant="outline" className="w-full gap-2">
                        Contactar Ventas
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-2 gradient-violet text-white border-0 hover:opacity-90"
                        onClick={handleUpgrade}
                        disabled={upgrading}
                      >
                        {upgrading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Rocket className="h-4 w-4" />
                        )}
                        {upgrading ? "Cargando..." : "Hacer Upgrade"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── FAQ / Info ─── */}
      <Card className="glass bg-card/40 border-border/50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-violet text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">¿Cómo funciona la facturación?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Los upgrades se aplican inmediatamente. Puedes cancelar en
                cualquier momento y conservarás el acceso hasta el final del
                período de facturación. Los pagos se procesan de forma segura
                con Stripe — nunca almacenamos datos de tarjetas de crédito en
                nuestros servidores.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* ─── Stripe Checkout Modal ─── */}
      <StripeCheckoutModal
        open={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function BillingPageWrapper() {
  return (
    <Suspense fallback={<InnovativeLoader fullScreen={true} message="Cargando facturación..." />}>
      <BillingPageContent />
    </Suspense>
  );
}
