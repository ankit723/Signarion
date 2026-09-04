import Link from "next/link";

import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/auth";

export const BRAND_NAME = "Signarion";

/**
 * Logo mark + wordmark. Links home unless `asLink={false}`.
 * The mark carries its own fixed brand colours (see LogoMark) rather than
 * theme tokens — it's the logo, not chrome.
 */
export function Brand({
  asLink = true,
  className,
}: {
  asLink?: boolean;
  className?: string;
}) {
  const inner = (
    <span className={cn("group/brand inline-flex items-center gap-1.5", className)}>
      <LogoMark className="h-7 transition-transform duration-200 rotate-19" />
      <span className="font-heading text-[1rem] font-semibold tracking-tight text-foreground mt-2.5 -ml-2">
        igna<span className="text-primary">rion</span>
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
