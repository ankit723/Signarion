import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info";

/** Inline (non-toast) feedback for a form. Announced to screen readers. */
export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlertIcon : tone === "success" ? CircleCheckIcon : InfoIcon;
  return (
    <div
      role="alert"
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "success" && "border-emerald-600/25 bg-emerald-500/10 text-foreground [&_svg]:text-emerald-700 dark:[&_svg]:text-emerald-400",
        tone === "info" && "border-border bg-muted text-foreground"
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
