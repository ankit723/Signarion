import Link from "next/link";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/auth";

export const BRAND_NAME = "Signarion";

/**
 * Solid ink glyph + wordmark. Links home unless `asLink={false}`.
 * Colours follow the theme tokens, so a `.dark`-scoped region inverts it for free.
 *
 * The mark: a broadcast node — one point emitting concentric signal arcs.
 */
export function Brand({
  asLink = true,
  className,
}: {
  asLink?: boolean;
  className?: string;
}) {
  const inner = (
    <span className={cn("group/brand inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/brand:-rotate-6"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4.5">
          <circle cx="6.5" cy="17.5" r="2.25" fill="currentColor" />
          <path
            d="M6 12.5a5.5 5.5 0 0 1 5.5 5.5M6 6.5A11.5 11.5 0 0 1 17.5 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="font-heading text-[0.95rem] font-semibold tracking-tight text-foreground">
        {BRAND_NAME}
      </span>
    </span>
  );

  return asLink ? (
    <Link
      href={ROUTES.home}
      className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
