import { Spinner } from "@/components/ui/spinner";

/** Suspense fallback for auth screens while search params resolve. */
export function AuthFallback() {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-5" />
      Loading…
    </div>
  );
}
