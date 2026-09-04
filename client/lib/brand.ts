/**
 * Brand-identity helpers. ICP brand fields can come from the model as well as
 * the crawler, so colours and URLs are treated as untrusted and sanitised
 * before they touch `style` or `src`.
 */
import type { IcpBrandIdentity, Workspace } from "@/types/workspace";

const NAMED = /^[a-z]{3,20}$/i;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\([0-9a-z%.,\s/+-]+\)$/i;

/** Returns a safe CSS colour string, or null if it can't be trusted. */
export function safeColor(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  if (!v || v.length > 64) return null;
  if (/url\(|expression|javascript:|@import|[<>{}]|;/i.test(v)) return null;
  if (HEX.test(v) || FUNC.test(v) || NAMED.test(v)) return v;
  return null;
}

/** Returns a safe http(s) image URL, or null. */
export function safeImageUrl(input?: string | null): string | null {
  if (!input) return null;
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

const brandOf = (workspace: Pick<Workspace, "icp">): IcpBrandIdentity =>
  workspace.icp?.brand_identity ?? {};

/** The workspace's accent colour, if it has a usable one. */
export function workspaceAccent(workspace: Pick<Workspace, "icp">): string | null {
  const b = brandOf(workspace);
  return safeColor(b.primary_color) ?? safeColor(b.accent_color) ?? null;
}

/** A very light wash of the accent, for tinted surfaces. Null when no accent. */
export function workspaceTint(
  workspace: Pick<Workspace, "icp">,
  amount = 92
): string | null {
  const accent = workspaceAccent(workspace);
  return accent ? `color-mix(in oklab, ${accent}, transparent ${amount}%)` : null;
}

/** Accent + tint as a `style` object of CSS custom properties (or undefined). */
export function brandVars(workspace: Pick<Workspace, "icp">): React.CSSProperties | undefined {
  const accent = workspaceAccent(workspace);
  if (!accent) return undefined;
  return {
    "--ws-accent": accent,
    "--ws-tint": `color-mix(in oklab, ${accent}, transparent 92%)`,
    "--ws-tint-strong": `color-mix(in oklab, ${accent}, transparent 85%)`,
  } as React.CSSProperties;
}

/**
 * A favicon to represent the workspace: the site's own, else Google's favicon
 * service for the tracked domain, else null (caller falls back to initials).
 */
export function workspaceFavicon(
  workspace: Pick<Workspace, "icp" | "trackedDomain">
): string | null {
  const own = safeImageUrl(brandOf(workspace).favicon_url);
  if (own) return own;
  const domain = workspace.trackedDomain?.trim();
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }
  return null;
}
