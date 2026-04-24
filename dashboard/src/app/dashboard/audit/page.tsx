"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Search,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { AuditEntry } from "@/lib/api";

const actionLabels: Record<string, { label: string; color: string }> = {
  context_switch: { label: "Context Switch", color: "bg-primary/10 text-primary" },
  env_inject: { label: "Env Inject", color: "bg-success/10 text-success" },
  git_switch: { label: "Git Switch", color: "bg-chart-3/10 text-chart-3" },
  cli_switch: { label: "CLI Switch", color: "bg-warning/10 text-warning" },
  project_init: { label: "Init", color: "bg-muted text-muted-foreground" },
  error: { label: "Error", color: "bg-destructive/10 text-destructive" },
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { action?: string; success?: boolean; limit?: number } = { limit: 100 };
      if (filterAction !== "all") params.action = filterAction;
      if (filterStatus === "success") params.success = true;
      if (filterStatus === "error") params.success = false;

      const data = await api.listAudit(params);
      setEntries(data);
    } catch (err) {
      console.error("Error loading audit:", err);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side search filter
  const filtered = entries.filter((entry) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        entry.message.toLowerCase().includes(q) ||
        (entry.project_name || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="mt-1 text-muted-foreground">
            Registro inmutable de todas las acciones ejecutadas por los skills.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por proyecto o mensaje..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterAction} onValueChange={(v) => v && setFilterAction(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="context_switch">Context Switch</SelectItem>
                <SelectItem value="env_inject">Env Inject</SelectItem>
                <SelectItem value="git_switch">Git Switch</SelectItem>
                <SelectItem value="cli_switch">CLI Switch</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Exitosos</SelectItem>
                <SelectItem value="error">Fallidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass bg-card/40 border-border/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-900/10 hover:border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            ) : null}
            {filtered.length} registro{filtered.length !== 1 && "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Entorno</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead className="text-right">Duración</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const action = actionLabels[entry.action] || {
                  label: entry.action,
                  color: "bg-muted text-muted-foreground",
                };
                return (
                  <TableRow key={entry.id} className="group">
                    <TableCell>
                      {entry.success ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(entry.created_at).toLocaleString("es-MX", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${action.color}`}>
                        {action.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {entry.project_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {entry.environment ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {entry.message}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-muted-foreground">
                      {entry.duration_ms ?? 0}ms
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
