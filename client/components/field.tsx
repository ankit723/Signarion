"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldProps extends Omit<React.ComponentProps<"input">, "id"> {
  label: string;
  error?: string;
  icon?: LucideIcon;
  /** Right-aligned control beside the label (e.g. a "Forgot?" link). */
  action?: React.ReactNode;
}

/** Labelled input with a leading icon, inline error, and password reveal. */
export function Field({
  label,
  error,
  icon: Icon,
  action,
  type = "text",
  className,
  ...props
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>

      <div className="relative">
        {Icon ? (
          <Icon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        ) : null}

        <Input
          id={id}
          type={isPassword && show ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn("h-11", Icon && "pl-9", isPassword && "pr-10", className)}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((value) => !value)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
