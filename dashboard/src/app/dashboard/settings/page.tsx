"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiKeyResponse } from "@/lib/api";
import {
  User,
  Mail,
  CreditCard,
  Shield,
  Moon,
  Sun,
  Monitor,
  Check,
  Lock,
  Zap,
  Infinity,
  Users,
  ScrollText,
  Loader2,
  Save,
  Key,
  Copy,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Terminal,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyResponse[]>([]);
  const [newKeyName, setNewKeyName] = useState("CLI Key");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showKey, setShowKey] = useState(true);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const keys = await api.listApiKeys();
      setApiKeys(keys);
    } catch (err) {
      console.error("Error loading API keys:", err);
    }
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const result = await api.generateApiKey(newKeyName);
      setGeneratedKey(result.full_key);
      setNewKeyName("CLI Key");
      await loadApiKeys();
    } catch (err) {
      console.error("Error generating API key:", err);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await api.revokeApiKey(keyId);
      await loadApiKeys();
      setGeneratedKey(null);
    } catch (err) {
      console.error("Error revoking API key:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateProfile({ display_name: name });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error updating profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("") || "?";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-1 text-muted-foreground">
          Gestiona tu perfil, plan y preferencias.
        </p>
      </div>

      {/* ─── Profile Section ─── */}
      <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
          <CardDescription>
            Tu información personal y credenciales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{user?.display_name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="uppercase text-[10px]">
                {user?.plan || "free"}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="mr-1 inline h-3.5 w-3.5" />
                Email
              </Label>
              <Input id="email" defaultValue={user?.email} disabled />
            </div>
          </div>

          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </CardContent>
      </Card>

      {/* ─── Theme Section ─── */}
      <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4" />
            Apariencia
          </CardTitle>
          <CardDescription>Personaliza el tema del dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: "light", icon: Sun, label: "Claro" },
              { value: "dark", icon: Moon, label: "Oscuro" },
              { value: "system", icon: Monitor, label: "Sistema" },
            ].map((opt) => (
              <Button
                key={opt.value}
                variant={theme === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(opt.value)}
                className="gap-2"
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── API Keys Section ─── */}
      <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Keys
          </CardTitle>
          <CardDescription>
            Genera API keys para conectar el CLI de Nexus con la nube.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generate new key */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="keyName">Nombre de la key</Label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="CLI Key, CI/CD, etc."
              />
            </div>
            <Button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="gap-2"
            >
              {generatingKey ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Generar Key
            </Button>
          </div>

          {/* Show generated key (only once) */}
          {generatedKey && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Shield className="h-4 w-4" />
                ¡API Key generada! Cópiala ahora — no se mostrará de nuevo.
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={showKey ? generatedKey : "ag_live_" + "•".repeat(40)}
                    readOnly
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKey}
                  className="gap-2 shrink-0"
                >
                  {keyCopied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {keyCopied ? "¡Copiada!" : "Copiar"}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <Terminal className="inline h-3 w-3 mr-1" />
                Usa: <code className="text-primary">nexus login</code> y pega esta key.
              </div>
            </div>
          )}

          {/* Active keys list */}
          {apiKeys.length > 0 && (
            <div className="space-y-2">
              <Label>Keys activas</Label>
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{key.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {key.key_prefix}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {key.last_used_at
                        ? `Último uso: ${new Date(key.last_used_at).toLocaleDateString()}`
                        : "Nunca usada"}
                      {" · "}
                      Creada: {new Date(key.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeKey(key.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Encryption badge */}
          <Separator />
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Lock className="h-4 w-4 text-success" />
            <div>
              <div className="text-xs font-medium">Encriptación AES-256-GCM</div>
              <div className="text-xs text-muted-foreground">
                Secretos encriptados localmente con Argon2id key derivation.
              </div>
            </div>
            <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
              ACTIVO
            </Badge>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
