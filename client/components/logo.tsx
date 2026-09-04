import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The Signarion mark: a signal broadcasting from a single node, resolving
 * into a deliberate "S" that lands on a solid target point. Fixed brand
 * colours (not theme tokens) — this is the logo, not chrome.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();

  return (
    <svg
      viewBox="0 0 62 112"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${id}-ink`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id={`${id}-signal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path
        d="M26,34 A17,17 0 0,0 26,68 A17,17 0 0,1 26,102"
        fill="none"
        stroke={`url(#${id}-ink)`}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx="26" cy="102" r="5" fill="#06B6D4" />
      <path
        d="M26,18 A16,16 0 0,1 42,34"
        fill="none"
        stroke={`url(#${id}-signal)`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M26,7 A27,27 0 0,1 53,34"
        fill="none"
        stroke={`url(#${id}-signal)`}
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

/** Full lockup — mark, two-tone wordmark and tagline. For hero/marketing use. */
export function LogoFull({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className="h-10" />
      <span className="flex flex-col justify-center">
        <span className="font-heading text-3xl leading-none font-extrabold tracking-tight text-foreground">
          Signa<span className="text-[#2563EB]">rion</span>
        </span>
        <span className="mt-1.5 text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Signal-based outreach
        </span>
      </span>
    </span>
  );
}
