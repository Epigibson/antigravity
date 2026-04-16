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
import { Button } from "@/components/ui/button";

// ─── Payment Form (inside Elements provider) ───

function CheckoutForm({
  onSuccess,
  onCancel,
}: {
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

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/billing?status=success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Error procesando el pago.");
      setProcessing(false);
    } else {
      setSucceeded(true);
      setProcessing(false);
      setTimeout(onSuccess, 1500);
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-green-500">¡Pago Exitoso!</h3>
        <p className="text-sm text-muted-foreground text-center">
          Tu plan Premium ya está activo. Redirigiendo...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Elements */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in duration-200">
          <CreditCard className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Pago seguro con encriptación SSL de 256 bits
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={processing}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 gap-2 gradient-violet text-white border-0 hover:opacity-90"
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {processing ? "Procesando..." : "Pagar $12/mes"}
        </Button>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch publishable key and create subscription in parallel
      const [config, subscription] = await Promise.all([
        api.getStripeConfig(),
        api.createSubscription(),
      ]);

      setStripePromise(loadStripe(config.publishable_key));
      setClientSecret(subscription.client_secret);
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
      setError(null);
    }
  }, [open, initCheckout]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header gradient bar */}
        <div className="h-1 w-full gradient-violet" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-5 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-violet text-white shadow-lg shadow-primary/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Upgrade a Premium</h2>
              <p className="text-sm text-muted-foreground">
                Potencia tu flujo de desarrollo
              </p>
            </div>
          </div>

          {/* Plan summary */}
          <div className="rounded-xl bg-muted/30 border border-border p-4 mb-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Nexus Premium</span>
              <span className="text-lg font-bold font-mono">$12<span className="text-xs text-muted-foreground font-normal">/mes</span></span>
            </div>
            <div className="space-y-1">
              {[
                "Proyectos ilimitados",
                "Skills automatizados",
                "Soporte prioritario",
              ].map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Check className="h-3 w-3 text-success shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            {user?.email && (
              <div className="border-t border-border/40 pt-2 mt-2">
                <p className="text-[10px] text-muted-foreground">
                  Facturar a: <span className="text-foreground font-mono">{user.email}</span>
                </p>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Preparando checkout seguro...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive w-full">
                {error}
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cerrar
                </Button>
                <Button
                  className="flex-1 gap-2 gradient-violet text-white border-0 hover:opacity-90"
                  onClick={initCheckout}
                >
                  <Loader2 className="h-4 w-4" />
                  Reintentar
                </Button>
              </div>
            </div>
          ) : clientSecret && stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#8b5cf6",
                    colorBackground: "#1a1a2e",
                    colorText: "#e2e8f0",
                    colorTextSecondary: "#94a3b8",
                    colorDanger: "#ef4444",
                    fontFamily: "Inter, system-ui, sans-serif",
                    borderRadius: "10px",
                    spacingUnit: "4px",
                    fontSizeBase: "14px",
                  },
                  rules: {
                    ".Input": {
                      backgroundColor: "#1e1e38",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "none",
                      padding: "10px 12px",
                    },
                    ".Input:focus": {
                      border: "1px solid #8b5cf6",
                      boxShadow: "0 0 0 1px #8b5cf6",
                    },
                    ".Tab": {
                      backgroundColor: "#1e1e38",
                      border: "1px solid rgba(255,255,255,0.08)",
                    },
                    ".Tab--selected": {
                      backgroundColor: "#2a2a4a",
                      border: "1px solid #8b5cf6",
                    },
                    ".Label": {
                      fontSize: "13px",
                      fontWeight: "500",
                    },
                  },
                },
              }}
            >
              <CheckoutForm onSuccess={onSuccess} onCancel={onClose} />
            </Elements>
          ) : null}
        </div>
      </div>
    </div>
  );
}
