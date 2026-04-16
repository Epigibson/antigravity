"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Rocket,
  Check,
  Loader2,
  ShieldCheck,
  X,
  CreditCard,
  Sparkles,
} from "lucide-react";

// ─── Nexus dark theme for Stripe Elements ───
const NEXUS_STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#a78bfa",
    colorBackground: "#1c1c30",
    colorText: "#e2e8f0",
    colorTextSecondary: "#94a3b8",
    colorDanger: "#f87171",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
    fontSizeBase: "14px",
    colorIcon: "#8b5cf6",
    colorIconHover: "#a78bfa",
  },
  rules: {
    ".Input": {
      backgroundColor: "#22223a",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "none",
      padding: "12px 14px",
      transition: "border-color 0.2s, box-shadow 0.2s",
    },
    ".Input:focus": {
      border: "1px solid #8b5cf6",
      boxShadow: "0 0 0 2px rgba(139,92,246,0.25)",
    },
    ".Input:hover": {
      border: "1px solid rgba(255,255,255,0.15)",
    },
    ".Label": {
      fontSize: "13px",
      fontWeight: "500",
      color: "#94a3b8",
      marginBottom: "6px",
    },
    ".Tab": {
      backgroundColor: "#22223a",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#94a3b8",
    },
    ".Tab--selected": {
      backgroundColor: "#2a2a4a",
      border: "1px solid #8b5cf6",
      color: "#e2e8f0",
    },
    ".Tab:hover": {
      backgroundColor: "#2a2a4a",
    },
    ".Block": {
      backgroundColor: "#1c1c30",
      borderColor: "rgba(255,255,255,0.06)",
    },
  },
};

// ─── Payment Form (inside Elements provider) ───

function CheckoutForm({
  setupIntentId,
  onSuccess,
  onCancel,
}: {
  setupIntentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    // Confirm the SetupIntent (saves the card)
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Error al procesar el pago.");
      setProcessing(false);
      return;
    }

    if (setupIntent?.status === "succeeded") {
      // Now create the actual subscription server-side
      try {
        await api.confirmSubscription(setupIntentId);
        setSucceeded(true);
        setTimeout(onSuccess, 1500);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error al activar la suscripción."
        );
      }
    } else {
      setError("El pago no se completó. Intenta de nuevo.");
    }
    setProcessing(false);
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-emerald-400">¡Pago Exitoso!</h3>
        <p className="text-sm text-muted-foreground text-center">
          Tu plan Premium ya está activo. Redirigiendo...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stripe Elements */}
      <div className="rounded-xl overflow-hidden">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 animate-in fade-in duration-200">
          <CreditCard className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60">
        <ShieldCheck className="h-3.5 w-3.5" />
        Pago seguro — encriptación SSL de 256 bits
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={onCancel}
          disabled={processing}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 rounded-xl gradient-violet text-white px-4 py-2.5 text-sm font-medium border-0 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {processing ? "Procesando..." : "Suscribirme — $12/mes"}
        </button>
      </div>
    </form>
  );
}

// ─── Main Modal Component ───

export default function StripeCheckoutModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [config, subscription] = await Promise.all([
        api.getStripeConfig(),
        api.createSubscription(),
      ]);

      setStripePromise(loadStripe(config.publishable_key));
      setClientSecret(subscription.client_secret);
      setSetupIntentId(subscription.subscription_id);
    } catch (err) {
      console.error("Checkout init error:", err);
      setError(
        err instanceof Error ? err.message : "Error al iniciar el checkout."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      initCheckout();
    } else {
      setClientSecret(null);
      setSetupIntentId(null);
      setError(null);
    }
  }, [open, initCheckout]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/[0.06] bg-[#141424] shadow-2xl shadow-primary/10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header gradient bar */}
        <div className="h-1 w-full gradient-violet" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-5 rounded-lg p-1 text-white/40 hover:text-white hover:bg-white/5 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Title */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-violet text-white shadow-lg shadow-primary/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Upgrade a Premium
              </h2>
              <p className="text-xs text-white/40">
                Potencia tu flujo de desarrollo
              </p>
            </div>
          </div>

          {/* Plan summary card */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">
                Nexus Premium
              </span>
              <span className="text-lg font-bold font-mono text-white">
                $12
                <span className="text-xs text-white/40 font-normal">/mes</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                "Proyectos ilimitados",
                "Skills automatizados",
                "Soporte prioritario",
              ].map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 text-xs text-white/50"
                >
                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            {user?.email && (
              <div className="border-t border-white/[0.06] pt-2 mt-3">
                <p className="text-[10px] text-white/30">
                  Facturar a:{" "}
                  <span className="text-white/60 font-mono">{user.email}</span>
                </p>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-white/40">
                Preparando checkout seguro...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 w-full">
                {error}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
                  onClick={onClose}
                >
                  Cerrar
                </button>
                <button
                  className="flex-1 rounded-xl gradient-violet text-white px-4 py-2.5 text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  onClick={initCheckout}
                >
                  <Loader2 className="h-4 w-4" />
                  Reintentar
                </button>
              </div>
            </div>
          ) : clientSecret && stripePromise && setupIntentId ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: NEXUS_STRIPE_APPEARANCE,
              }}
            >
              <CheckoutForm
                setupIntentId={setupIntentId}
                onSuccess={onSuccess}
                onCancel={onClose}
              />
            </Elements>
          ) : null}
        </div>
      </div>
    </div>
  );
}
