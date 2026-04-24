import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500",
        "rounded-2xl border border-dashed border-border/50 glass bg-card/20",
        className
      )}
    >
      <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/10 duration-[3000ms]" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-primary/10 duration-2000" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 text-primary shadow-lg shadow-primary/10 border border-primary/20">
          {icon}
        </div>
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
