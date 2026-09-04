import { ArcField } from "@/components/arc-field";
import { Brand } from "@/components/brand";
import { Reveal } from "@/components/reveal";

const POINTS = [
  {
    k: "01",
    title: "See intent as it happens",
    text: "Hiring, tech-stack, funding and product-usage signals land on one timeline per account.",
  },
  {
    k: "02",
    title: "Sequences that keep up",
    text: "Messaging re-shapes itself around the freshest signal — not last quarter's list.",
  },
  {
    k: "03",
    title: "Secure by default",
    text: "Firebase-backed auth, encrypted sessions, no shared credentials.",
  },
];

/** Split frame shared by every auth screen: dark-scoped panel + paper form column. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="dark relative hidden overflow-hidden bg-background p-10 text-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <ArcField className="pointer-events-none absolute -bottom-24 -left-20 size-112 text-primary/15" />

        <Brand />

        <div className="relative max-w-md">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Why Signarion
          </p>
          <h2 className="mt-4 font-heading text-2xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-3xl">
            Reach the right people before your competitors know they&apos;re looking.
          </h2>

          <ul className="mt-9 space-y-px">
            {POINTS.map(({ k, title, text }) => (
              <li
                key={k}
                className="flex gap-4 border-t border-border/70 py-4 last:border-b"
              >
                <span className="font-mono text-xs text-muted-foreground">{k}</span>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground text-pretty">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-muted-foreground text-pretty">
          Built for teams who&apos;d rather act on a signal today than a list next quarter.
        </p>
      </aside>

      <div className="flex flex-col bg-background">
        <header className="flex items-center px-6 py-5 lg:hidden">
          <Brand />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-12 lg:px-14">
          <Reveal y={10} className="w-full max-w-sm">
            {children}
          </Reveal>
        </main>
      </div>
    </div>
  );
}
