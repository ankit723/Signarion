"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface RevealProps extends React.ComponentProps<"div"> {
  /** Stagger offset in ms, applied as transition-delay once revealed. */
  delay?: number;
  /** How far to travel on the way in. */
  y?: number;
}

/**
 * Fades + lifts its children in when they scroll into view (once).
 * - Respects `prefers-reduced-motion` (opacity only, no travel).
 * - Content is always in the DOM (only opacity/transform change), so it stays
 *   crawlable and doesn't reflow.
 */
export function Reveal({ delay = 0, y = 12, className, style, children, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefersReduced);

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setShown(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px", threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={cn(
        "transition-[opacity,transform,filter] duration-440 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "motion-reduce:transition-opacity motion-reduce:duration-200",
        !shown && "opacity-0",
        className
      )}
      style={{
        transitionDelay: shown ? `${delay}ms` : undefined,
        transform: shown || reduced ? undefined : `translate3d(0, ${y}px, 0)`,
        filter: shown || reduced ? undefined : "blur(4px)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
