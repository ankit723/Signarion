import { SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared placeholder card for the detail and settings pages. */
export function EmptyShell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-card ring-1 ring-foreground/10">
        <SparklesIcon className="size-5 text-primary" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground text-pretty">{body}</p>
      </div>
      {children}
    </div>
  );
}
