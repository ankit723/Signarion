/**
 * Faint concentric-arc motif that echoes the Signarion mark (a broadcast node
 * emitting signal arcs). Purely decorative — colour comes from `currentColor`,
 * so callers set opacity via a `text-*` class.
 */
export function ArcField({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="40" cy="360" r="8" fill="currentColor" stroke="none" />
      {[70, 130, 200, 280, 370].map((r) => (
        <path key={r} d={`M40 ${360 - r} A ${r} ${r} 0 0 1 ${40 + r} 360`} />
      ))}
    </svg>
  );
}
