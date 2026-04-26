"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ApiKeyResponse } from "@/lib/api";
import { toast } from "sonner";
import {
  User, Mail, Shield, ShieldCheck, Smartphone, Moon, Sun, Monitor,
  Check, Lock, Loader2, Save, Key, Copy, Trash2, Plus, Eye, EyeOff,
  Terminal, KeyRound, ShieldOff, Palette, Fingerprint, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type SettingsTab = "profile" | "security" | "appearance";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshProfile, setupTotp, verifyTotp, getMfaStatus, disableMfa } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [name, setName] = useState(user?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKeyResponse[]>([]);
  const [newKeyName, setNewKeyName] = useState("CLI Key");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showKey, setShowKey] = useState(true);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaSetupMode, setMfaSetupMode] = useState(false);
  const [mfaQrUri, setMfaQrUri] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaDisabling, setMfaDisabling] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => { loadApiKeys(); loadMfaStatus(); }, []);

  const loadApiKeys = async () => { try { setApiKeys(await api.listApiKeys()); } catch {} };
  const loadMfaStatus = async () => {
    setMfaLoading(true);
    try { const s = await getMfaStatus(); setMfaEnabled(s.enabled); } catch { setMfaEnabled(false); }
    finally { setMfaLoading(false); }
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try { const r = await api.generateApiKey(newKeyName); setGeneratedKey(r.full_key); setNewKeyName("CLI Key"); await loadApiKeys(); }
    catch (e) { console.error(e); } finally { setGeneratingKey(false); }
  };
  const handleCopyKey = async () => { if (generatedKey) { await navigator.clipboard.writeText(generatedKey); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); } };
  const handleRevokeKey = async (id: string) => { try { await api.revokeApiKey(id); await loadApiKeys(); setGeneratedKey(null); } catch {} };
  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try { await api.updateProfile({ display_name: name }); await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch {} finally { setSaving(false); }
  };
  const handleStartMfaSetup = async () => {
    try { const r = await setupTotp(); setMfaQrUri(r.qrCodeUri); setMfaSecret(r.secretKey); setMfaSetupMode(true); setMfaCode(""); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error al iniciar 2FA"); }
  };
  const handleVerifyMfa = async () => {
    if (mfaCode.length !== 6) return; setMfaVerifying(true);
    try { await verifyTotp(mfaCode); setMfaEnabled(true); setMfaSetupMode(false); setMfaQrUri(""); setMfaSecret(""); setMfaCode(""); toast.success("¡2FA activado!"); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Código inválido"); } finally { setMfaVerifying(false); }
  };
  const handleDisableMfa = async () => {
    setMfaDisabling(true);
    try { await disableMfa(); setMfaEnabled(false); toast.success("2FA desactivado"); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); } finally { setMfaDisabling(false); }
  };
  const handleCopySecret = async () => { await navigator.clipboard.writeText(mfaSecret); setSecretCopied(true); setTimeout(() => setSecretCopied(false), 2000); };

  const initials = user?.display_name?.split(" ").map((n) => n[0]).join("") || "?";

  const tabs: { id: SettingsTab; label: string; icon: typeof User; desc: string }[] = [
    { id: "profile", label: "Perfil", icon: User, desc: "Datos personales" },
    { id: "security", label: "Seguridad", icon: Shield, desc: "2FA y API Keys" },
    { id: "appearance", label: "Apariencia", icon: Palette, desc: "Tema visual" },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Premium Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 glass bg-card/30 p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-500/10 blur-[60px]" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-fuchsia-500/8 blur-[50px]" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">{user?.display_name}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Badge className="gradient-violet text-white border-0 text-[10px] uppercase px-3 py-1 shadow-lg shadow-violet-500/20">
            {user?.plan || "free"}
          </Badge>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="grid grid-cols-3 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all duration-300 ${
              activeTab === tab.id
                ? "border-primary/50 bg-primary/5 shadow-lg shadow-violet-900/10"
                : "border-border/30 hover:border-primary/20 hover:bg-card/60"
            }`}
          >
            <div className={`rounded-lg p-2 transition-colors ${
              activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground group-hover:text-foreground"
            }`}>
              <tab.icon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <div className={`text-sm font-semibold ${activeTab === tab.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>{tab.label}</div>
              <div className="text-[11px] text-muted-foreground hidden sm:block">{tab.desc}</div>
            </div>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full gradient-violet" />
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB: PERFIL ═══ */}
      {activeTab === "profile" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Información Personal
              </CardTitle>
              <CardDescription>Actualiza tu nombre y datos de perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email"><Mail className="mr-1 inline h-3.5 w-3.5" />Email</Label>
                  <Input id="email" defaultValue={user?.email} disabled className="bg-background/30" />
                </div>
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 gradient-violet text-white border-0 shadow-lg shadow-violet-500/20 hover:opacity-90">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ TAB: SEGURIDAD ═══ */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Security Overview Mini-Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 glass bg-card/30 p-4 text-center">
              <Fingerprint className={`h-5 w-5 mx-auto mb-1.5 ${mfaEnabled ? "text-emerald-500" : "text-amber-500"}`} />
              <div className="text-xs font-medium">{mfaEnabled ? "2FA Activo" : "2FA Inactivo"}</div>
            </div>
            <div className="rounded-xl border border-border/50 glass bg-card/30 p-4 text-center">
              <Key className="h-5 w-5 mx-auto mb-1.5 text-primary" />
              <div className="text-xs font-medium">{apiKeys.length} API Key{apiKeys.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="rounded-xl border border-border/50 glass bg-card/30 p-4 text-center">
              <Lock className="h-5 w-5 mx-auto mb-1.5 text-emerald-500" />
              <div className="text-xs font-medium">AES-256</div>
            </div>
          </div>

          {/* 2FA Card */}
          <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4" />
                    Autenticación de 2 Pasos
                  </CardTitle>
                  <CardDescription>Código temporal con tu app autenticadora.</CardDescription>
                </div>
                {!mfaLoading && (
                  <Badge variant={mfaEnabled ? "default" : "secondary"} className={`text-[10px] uppercase ${mfaEnabled ? "bg-emerald-600" : ""}`}>
                    {mfaEnabled ? "✓ Activo" : "Inactivo"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mfaLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verificando...</div>
              ) : mfaEnabled && !mfaSetupMode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="rounded-lg bg-emerald-500/10 p-2"><ShieldCheck className="h-5 w-5 text-emerald-500" /></div>
                    <div>
                      <div className="text-sm font-medium">Cuenta protegida</div>
                      <div className="text-xs text-muted-foreground">Código requerido en cada inicio de sesión.</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisableMfa} disabled={mfaDisabling} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                    {mfaDisabling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                    {mfaDisabling ? "Desactivando..." : "Desactivar 2FA"}
                  </Button>
                </div>
              ) : mfaSetupMode ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Progress Stepper */}
                  <div className="flex items-center gap-0 mb-6">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-violet text-xs font-bold text-white shadow-lg shadow-violet-500/30">1</div>
                      <span className="text-sm font-semibold hidden sm:inline">Escanear</span>
                    </div>
                    <div className="flex-1 mx-3 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-violet-500/30" />
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${mfaCode.length > 0 ? "gradient-violet text-white shadow-lg shadow-violet-500/30" : "bg-muted text-muted-foreground"}`}>2</div>
                      <span className="text-sm font-semibold hidden sm:inline">Verificar</span>
                    </div>
                    <div className="flex-1 mx-3 h-0.5 rounded-full bg-muted" />
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">✓</div>
                      <span className="text-sm font-semibold hidden sm:inline text-muted-foreground">Listo</span>
                    </div>
                  </div>

                  {/* Two-Column Layout */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Left: QR Code */}
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background/30 p-6 relative overflow-hidden">
                      {/* Decorative glow */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-48 w-48 rounded-full bg-violet-500/8 blur-[40px] animate-pulse" />
                      </div>
                      {/* QR Container */}
                      <div className="relative">
                        <div className="absolute -inset-3 rounded-3xl border-2 border-dashed border-violet-500/20 animate-[spin_20s_linear_infinite]" />
                        <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-violet-500/10 relative z-10">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaQrUri)}`}
                            alt="QR Code para 2FA"
                            className="h-[180px] w-[180px]"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground relative z-10">
                        <Smartphone className="h-3.5 w-3.5" />
                        Escanea con tu app autenticadora
                      </div>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {["Google Auth", "Authy", "1Password"].map((app) => (
                          <span key={app} className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{app}</span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Instructions + Verify */}
                    <div className="space-y-5">
                      {/* Manual Key */}
                      <div className="rounded-xl border border-border/50 bg-background/30 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Key className="h-3 w-3" />
                          ¿No puedes escanear? Usa la clave manual:
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] break-all select-all leading-relaxed">{mfaSecret}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopySecret}
                            className={`shrink-0 gap-1.5 transition-all ${secretCopied ? "border-emerald-500/50 text-emerald-500" : ""}`}
                          >
                            {secretCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {secretCopied ? "Copiada" : "Copiar"}
                          </Button>
                        </div>
                      </div>

                      {/* Verify Code */}
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          Ingresa el código de verificación
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Abre tu app autenticadora e ingresa el código de 6 dígitos que aparece.
                        </p>
                        <div className="flex gap-3">
                          <div className="relative flex-1 max-w-[220px]">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              placeholder="● ● ● ● ● ●"
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                              className="text-center text-2xl tracking-[0.3em] h-14 font-mono bg-background/80 border-primary/20 focus:border-primary/50"
                            />
                            {/* Progress dots */}
                            <div className="flex gap-1.5 justify-center mt-2">
                              {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${i < mfaCode.length ? "bg-primary scale-125" : "bg-muted"}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={handleVerifyMfa}
                          disabled={mfaCode.length !== 6 || mfaVerifying}
                          className="w-full gap-2 h-11 gradient-violet text-white border-0 shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all disabled:opacity-40"
                        >
                          {mfaVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          {mfaVerifying ? "Verificando código..." : "Activar Autenticación 2FA"}
                        </Button>
                      </div>

                      {/* Cancel */}
                      <Button variant="ghost" size="sm" onClick={() => { setMfaSetupMode(false); setMfaCode(""); }} className="text-muted-foreground hover:text-foreground">← Cancelar configuración</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="rounded-lg bg-amber-500/10 p-2"><Shield className="h-5 w-5 text-amber-500" /></div>
                    <div>
                      <div className="text-sm font-medium">Agrega una capa extra de seguridad</div>
                      <div className="text-xs text-muted-foreground">Códigos temporales con tu app autenticadora.</div>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleStartMfaSetup} className="gap-2 gradient-violet text-white border-0 shadow-lg shadow-violet-500/20">
                    <KeyRound className="h-3.5 w-3.5" />Configurar 2FA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Keys Card */}
          <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Key className="h-4 w-4" />API Keys</CardTitle>
              <CardDescription>Conecta el CLI de Nexus con la nube.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="keyName">Nombre</Label>
                  <Input id="keyName" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="CLI Key, CI/CD..." className="bg-background/50" />
                </div>
                <Button onClick={handleGenerateKey} disabled={generatingKey} className="gap-2 gradient-violet text-white border-0 shadow-lg shadow-violet-500/20">
                  {generatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Generar
                </Button>
              </div>

              {generatedKey && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary"><Shield className="h-4 w-4" />Cópiala ahora — no se mostrará de nuevo.</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input value={showKey ? generatedKey : "ag_live_" + "•".repeat(40)} readOnly className="font-mono text-xs pr-10" />
                      <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyKey} className="gap-2 shrink-0">
                      {keyCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {keyCopied ? "¡Copiada!" : "Copiar"}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground"><Terminal className="inline h-3 w-3 mr-1" />Usa: <code className="text-primary">nexus login</code> y pega esta key.</div>
                </div>
              )}

              {apiKeys.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Keys activas</Label>
                  {apiKeys.map((key) => (
                    <div key={key.id} className="group flex items-center justify-between rounded-xl border border-border/50 p-3 text-sm transition-all hover:border-primary/20 hover:bg-card/60">
                      <div className="space-y-0.5">
                        <div className="font-medium">{key.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{key.key_prefix}</div>
                        <div className="text-[11px] text-muted-foreground">{key.last_used_at ? `Uso: ${new Date(key.last_used_at).toLocaleDateString()}` : "Sin usar"} · {new Date(key.created_at).toLocaleDateString()}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRevokeKey(key.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Encryption Footer */}
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 glass p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2"><Lock className="h-4 w-4 text-emerald-500" /></div>
            <div>
              <div className="text-xs font-semibold">Encriptación AES-256-GCM</div>
              <div className="text-[11px] text-muted-foreground">Secretos encriptados con Argon2id key derivation.</div>
            </div>
            <Badge variant="secondary" className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">ACTIVO</Badge>
          </div>
        </div>
      )}

      {/* ═══ TAB: APARIENCIA ═══ */}
      {activeTab === "appearance" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" />Tema Visual</CardTitle>
              <CardDescription>Personaliza la apariencia del dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 max-w-lg">
                {[
                  { value: "light", icon: Sun, label: "Claro", desc: "Fondo claro y limpio", preview: "bg-white border-zinc-200" },
                  { value: "dark", icon: Moon, label: "Oscuro", desc: "Ideal para largas sesiones", preview: "bg-zinc-900 border-zinc-700" },
                  { value: "system", icon: Monitor, label: "Sistema", desc: "Sigue tu OS", preview: "bg-gradient-to-br from-white to-zinc-900 border-zinc-400" },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setTheme(opt.value)} className={`group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 transition-all duration-300 ${
                    theme === opt.value
                      ? "border-primary bg-primary/5 shadow-xl shadow-violet-900/15 scale-[1.02]"
                      : "border-border/30 hover:border-primary/30 hover:bg-card/60 hover:scale-[1.01]"
                  }`}>
                    {/* Mini Preview */}
                    <div className={`w-full h-12 rounded-lg border ${opt.preview} transition-all ${theme === opt.value ? "shadow-md" : ""}`}>
                      <div className="flex gap-1 p-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-400 opacity-60" />
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 opacity-60" />
                        <div className="h-1.5 w-1.5 rounded-full bg-green-400 opacity-60" />
                      </div>
                    </div>
                    <div className={`rounded-xl p-2.5 transition-colors ${theme === opt.value ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
                      <opt.icon className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                    </div>
                    {theme === opt.value && (
                      <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full gradient-violet flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
