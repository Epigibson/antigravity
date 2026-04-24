"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Zap, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        await register(email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[120px] animate-pulse duration-10000" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-fuchsia-600/10 blur-[100px] animate-pulse duration-7000 delay-1000" />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden shadow-lg shadow-primary/25 mb-4 animate-float border border-primary/20">
            <img src="/nexus-icon.png" alt="Nexus" className="h-14 w-14 object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nexus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control Center — {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 glass bg-card/60 shadow-2xl shadow-violet-900/10">
          <CardHeader className="pb-4">
            {/* Tabs */}
            <div className="flex rounded-lg bg-background/30 backdrop-blur-md border border-border/40 p-1 gap-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  mode === "login"
                    ? "bg-background/80 text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  mode === "register"
                    ? "bg-background/80 text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                }`}
              >
                Crear Cuenta
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2 animate-in slide-in-from-top-4 fade-in duration-300">
                  <Label htmlFor="displayName" className="flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Nombre
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Tu nombre"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-background/50 focus-visible:ring-violet-500/50 focus-visible:border-violet-500 transition-all"
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 focus-visible:ring-violet-500/50 focus-visible:border-violet-500 transition-all"
                  required
                  autoFocus={mode === "login"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5 text-sm">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50 focus-visible:ring-violet-500/50 focus-visible:border-violet-500 transition-all pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "register" && password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-amber-400">Mínimo 6 caracteres ({password.length}/6)</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden group gap-2 gradient-violet text-white border-0 hover:opacity-90 shadow-lg shadow-violet-900/20"
              >
                {/* Sweep shine effect */}
                <div className="absolute inset-0 -translate-x-[150%] skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
                
                {loading ? (
                  <div className="flex items-center justify-center relative w-5 h-5 mr-1">
                    <div className="absolute inset-0 animate-ping rounded-full bg-white/40" />
                    <div className="relative h-2 w-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <ArrowRight className="h-4 w-4 relative z-10" />
                )}
                <span className="relative z-10 font-medium">
                  {loading
                    ? (mode === "login" ? "Ingresando..." : "Creando cuenta...")
                    : (mode === "login" ? "Ingresar" : "Crear Cuenta")}
                </span>
              </Button>
            </form>

            {/* Toggle link */}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  ¿No tienes cuenta?{" "}
                  <button type="button" onClick={toggleMode} className="text-primary hover:underline font-medium">
                    Crear una
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{" "}
                  <button type="button" onClick={toggleMode} className="text-primary hover:underline font-medium">
                    Iniciar sesión
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Encriptación AES-256-GCM · Zero-Knowledge · Tus secretos nunca salen de tu máquina
        </p>
      </div>
    </div>
  );
}
