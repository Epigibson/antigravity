import { Loader2 } from "lucide-react";

interface InnovativeLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export function InnovativeLoader({
  message = "Cargando...",
  subMessage,
  fullScreen = true,
}: InnovativeLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 ${
        fullScreen ? "h-[60vh]" : "h-full py-12"
      }`}
    >
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

      {(message || subMessage) && (
        <div className="flex flex-col items-center gap-1">
          {message && (
            <h3 className="text-sm font-semibold tracking-wide text-foreground animate-pulse">
              {message}
            </h3>
          )}
          {subMessage && (
            <p className="text-xs text-muted-foreground">{subMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
