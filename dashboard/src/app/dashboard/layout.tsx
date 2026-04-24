"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  FolderKanban,
  ScrollText,
  Settings,
  CreditCard,
  Users,
  Zap,
  Moon,
  Sun,
  ChevronLeft,
  Terminal,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/dashboard/skills", label: "Skills", icon: Zap },
  { href: "/dashboard/team", label: "Equipo", icon: Users },
  { href: "/dashboard/audit", label: "Registro (Audit)", icon: ScrollText },
  { href: "/dashboard/billing", label: "Suscripción y Pagos", icon: CreditCard },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Animated glow rings */}
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 duration-1000" />
          <div className="absolute -inset-4 animate-pulse rounded-full bg-violet-500/10 duration-2000" />
          <div className="absolute -inset-8 animate-pulse rounded-full bg-fuchsia-500/5 duration-3000" />
          
          {/* Center crystal/core */}
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 shadow-2xl shadow-violet-500/40">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <h3 className="text-sm font-semibold tracking-wide text-foreground animate-pulse">Iniciando Sesión...</h3>
          <p className="text-xs text-muted-foreground">Verificando tus credenciales de Nexus</p>
        </div>
      </div>
    );
  }

  const initials = user?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("") || "?";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside
        className={cn(
          "flex flex-col border-r border-border/50 glass bg-card/40 z-20 transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-violet-900/10",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden">
            <img src="/nexus-icon.png" alt="Nexus" className="h-9 w-9 object-cover" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold tracking-tight text-foreground">
                Nexus
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                Control Center
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground",
              collapsed && "ml-0"
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </Button>
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 overflow-hidden group",
                  isActive
                    ? "text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))] bg-gradient-to-r from-primary/15 to-transparent"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground hover:translate-x-1"
                )}
              >
                <item.icon
                  className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary")}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* CLI Hint */}
        {!collapsed && (
          <div className="mx-3 mb-3 rounded-xl border border-border/50 glass bg-card/30 p-3 shadow-sm shadow-violet-900/5 transition-all hover:bg-card/50">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              CLI rápido
            </div>
            <code className="mt-1.5 block text-[11px] font-mono text-primary">
              nexus switch --env dev
            </code>
          </div>
        )}

        <Separator />

        {/* Footer: User + Theme + Logout */}
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-foreground">
                {user?.display_name || user?.email}
              </span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[9px] font-semibold uppercase"
                >
                  {user?.plan || "free"}
                </Badge>
              </div>
            </div>
          )}
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
