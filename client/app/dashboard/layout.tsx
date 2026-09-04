import type { ReactNode } from "react";

import { RequireAuth } from "@/components/guards";
import { SiteHeader } from "@/components/site-header";
import { WorkspacesProvider } from "@/context/workspaces-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <WorkspacesProvider>
        <div className="flex min-h-svh flex-col">
          <SiteHeader variant="app" />
          <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
        </div>
      </WorkspacesProvider>
    </RequireAuth>
  );
}
