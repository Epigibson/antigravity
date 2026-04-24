"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Crown,
  Trash2,
  Loader2,
  Mail,
  AlertCircle,
  Check,
  Lock,
} from "lucide-react";
import { InnovativeLoader } from "@/components/ui/innovative-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Member = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string;
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  owner: { label: "Propietario", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Crown },
  admin: { label: "Admin", color: "text-violet-400 bg-violet-400/10 border-violet-400/20", icon: ShieldCheck },
  member: { label: "Miembro", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: Shield },
};

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [planLimits, setPlanLimits] = useState<{ plan: string; limits: Record<string, unknown>; usage: { projects: number; members: number } } | null>(null);

  const loadData = async () => {
    try {
      const [membersData, limitsData] = await Promise.all([
        api.getTeamMembers(),
        api.getPlanLimits(),
      ]);
      setMembers(membersData);
      setPlanLimits(limitsData);
    } catch {
      toast.error("Error cargando datos del equipo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteTeamMember(inviteEmail.trim(), inviteRole);
      toast.success(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al invitar");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`¿Eliminar a ${email} del equipo?`)) return;
    try {
      await api.removeMember(userId);
      toast.success(`${email} fue eliminado del equipo`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.updateMemberRole(userId, role);
      toast.success("Rol actualizado");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar rol");
    }
  };

  const isPaidPlan = planLimits?.plan === "premium" || planLimits?.plan === "enterprise";
  const maxMembers = (planLimits?.limits?.max_members as number) || 1;
  const currentMembers = members.length;
  const isUnlimited = maxMembers > 9999;

  if (loading) {
    return <InnovativeLoader message="Cargando equipo..." subMessage="Obteniendo roles y permisos" />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          Gestión de Equipo
        </h1>
        <p className="text-muted-foreground mt-1">
          Administra los miembros de tu organización
        </p>
      </div>

      {/* Plan banner */}
      {!isPaidPlan && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              Plan Free — Máximo {maxMembers} miembro
            </p>
            <p className="text-xs text-amber-300/60 mt-1">
              Actualiza a Premium para invitar hasta 50 miembros y habilitar la gestión completa de equipos.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/50 glass bg-card/40 p-4 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:-translate-y-1">
          <p className="text-2xl font-bold font-mono">{currentMembers}</p>
          <p className="text-xs text-muted-foreground">Miembros</p>
        </div>
        <div className="rounded-xl border border-border/50 glass bg-card/40 p-4 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:-translate-y-1">
          <p className="text-2xl font-bold font-mono">{isUnlimited ? "∞" : maxMembers}</p>
          <p className="text-xs text-muted-foreground">Máximo del plan</p>
        </div>
        <div className="rounded-xl border border-border/50 glass bg-card/40 p-4 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:-translate-y-1">
          <p className="text-2xl font-bold font-mono">{planLimits?.usage?.projects || 0}</p>
          <p className="text-xs text-muted-foreground">Proyectos activos</p>
        </div>
      </div>

      {/* Invite form */}
      {isPaidPlan && (
        <div className="rounded-xl border border-border/50 glass bg-card/40 p-5 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <UserPlus className="h-4 w-4 text-primary" />
            Invitar Miembro
          </h2>
          <form onSubmit={handleInvite} className="flex gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                required
              />
            </div>
            <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
              <SelectTrigger className="w-[140px] rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none h-auto">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Miembro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="submit"
              disabled={inviting || currentMembers >= maxMembers}
              className="rounded-lg gradient-violet text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Invitar
            </button>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border border-border/50 glass bg-card/40 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Miembros ({currentMembers})</h2>
        </div>
        <div className="divide-y divide-border">
          {members.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
            const RoleIcon = roleConfig.icon;
            const isOwner = member.role === "owner";
            const isSelf = member.user_id === user?.id;

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary shrink-0">
                  {(member.display_name || member.email)[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {member.display_name || member.email.split("@")[0]}
                    </p>
                    {isSelf && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Tú</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>

                {/* Role badge */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${roleConfig.color}`}>
                  <RoleIcon className="h-3 w-3" />
                  {roleConfig.label}
                </div>

                {/* Actions */}
                {isPaidPlan && !isOwner && !isSelf && (
                  <div className="flex items-center gap-1">
                    <Select value={member.role} onValueChange={(v) => v && handleRoleChange(member.user_id, v)}>
                      <SelectTrigger className="w-[110px] h-8 text-xs rounded border border-border bg-background focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none">
                        <SelectValue placeholder="Rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member" className="text-xs">Miembro</SelectItem>
                        <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => handleRemove(member.user_id, member.email)}
                      className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Eliminar miembro"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
