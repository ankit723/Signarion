"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/context/auth-context";
import { workspaceApi } from "@/lib/workspaces";
import type { Icp, IcpJob, Workspace } from "@/types/workspace";

type ListStatus = "idle" | "loading" | "ready" | "error";

const needsJobPoll = (w: Workspace) => {
  const s = w.icpJob?.status;
  // Poll while it's working, and once more when it's "ready" but the light list
  // payload didn't include the draft (so the review UI has it).
  return s === "queued" || s === "running" || (s === "ready" && !w.icpJob?.draft);
};

interface WorkspacesValue {
  items: Workspace[];
  status: ListStatus;
  error: string | null;
  /** `true` while re-fetching in the background (list already shown). */
  refreshing: boolean;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Workspace>;
  update: (id: string, name: string) => Promise<Workspace>;
  /** Kick off background analysis. Poll `workspace.icpJob` for progress. */
  startAnalysis: (id: string, domain: string) => Promise<Workspace>;
  /** Persist an ICP (AI draft as-is, or edited). */
  saveIcp: (id: string, icp: Icp) => Promise<Workspace>;
  /** Throw away a ready / failed analysis draft. */
  discardIcpJob: (id: string) => Promise<Workspace>;
  removeMember: (id: string, memberUid: string) => Promise<Workspace>;
  remove: (id: string) => Promise<void>;
  /** Read one from the cache without a request. */
  getCached: (id: string) => Workspace | undefined;
  /** Merge a freshly fetched workspace into the cache. */
  put: (workspace: Workspace) => void;
  /** Shallow-merge fields into a cached workspace (no-op if it isn't cached). */
  mergeCached: (id: string, patch: Partial<Workspace>) => void;
}

const WorkspacesContext = createContext<WorkspacesValue | null>(null);

export function WorkspacesProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const [items, setItems] = useState<Workspace[]>([]);
  const [status, setStatus] = useState<ListStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    setError(null);
    setRefreshing(true);
    setStatus((s) => (s === "ready" ? s : "loading"));

    const run = (async () => {
      try {
        const list = await workspaceApi.list();
        setItems(list);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load workspaces.");
        setStatus((s) => (s === "ready" ? s : "error"));
      } finally {
        setRefreshing(false);
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") void load();
  }, [authStatus, load]);

  const put = useCallback((workspace: Workspace) => {
    setItems((current) => {
      const next = current.some((w) => w._id === workspace._id)
        ? current.map((w) => (w._id === workspace._id ? { ...w, ...workspace } : w))
        : [workspace, ...current];
      return next.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    });
  }, []);

  const mergeCached = useCallback((id: string, patch: Partial<Workspace>) => {
    setItems((current) =>
      current.map((w) => (w._id === id ? { ...w, ...patch } : w))
    );
  }, []);

  // Poll any workspace whose analysis is still running. One loop covers the
  // dashboard, the detail page and the dialog — they all read from this cache.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const activeIds = items.filter(needsJobPoll).map((w) => w._id);
    if (activeIds.length === 0) return;

    let cancelled = false;
    const tick = async () => {
      await Promise.all(
        activeIds.map(async (id) => {
          try {
            const icpJob: IcpJob = await workspaceApi.getIcpJob(id);
            if (!cancelled) mergeCached(id, { icpJob });
          } catch {
            /* transient — try again next tick */
          }
        })
      );
    };
    const interval = setInterval(tick, 3500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authStatus, items, mergeCached]);

  const create = useCallback(
    async (name: string) => {
      const created = await workspaceApi.create(name);
      put(created);
      return created;
    },
    [put]
  );

  const update = useCallback(
    async (id: string, name: string) => {
      const updated = await workspaceApi.update(id, name);
      put(updated);
      return updated;
    },
    [put]
  );

  const startAnalysis = useCallback(
    async (id: string, domain: string) => {
      const updated = await workspaceApi.startAnalysis(id, domain);
      put(updated);
      return updated;
    },
    [put]
  );

  const saveIcp = useCallback(
    async (id: string, icp: Icp) => {
      const updated = await workspaceApi.saveIcp(id, icp);
      put(updated);
      return updated;
    },
    [put]
  );

  const discardIcpJob = useCallback(
    async (id: string) => {
      const updated = await workspaceApi.discardIcpJob(id);
      put(updated);
      return updated;
    },
    [put]
  );

  const removeMember = useCallback(
    async (id: string, memberUid: string) => {
      const updated = await workspaceApi.removeMember(id, memberUid);
      put(updated);
      return updated;
    },
    [put]
  );

  const remove = useCallback(
    async (id: string) => {
      const snapshot = { done: false };
      setItems((current) => current.filter((w) => w._id !== id));
      try {
        await workspaceApi.remove(id);
        snapshot.done = true;
      } finally {
        if (!snapshot.done) void load();
      }
    },
    [load]
  );

  const getCached = useCallback(
    (id: string) => items.find((w) => w._id === id),
    [items]
  );

  const value = useMemo<WorkspacesValue>(
    () => ({
      items,
      status,
      error,
      refreshing,
      refresh: () => load(),
      create,
      update,
      startAnalysis,
      saveIcp,
      discardIcpJob,
      removeMember,
      remove,
      getCached,
      put,
      mergeCached,
    }),
    [
      items,
      status,
      error,
      refreshing,
      load,
      create,
      update,
      startAnalysis,
      saveIcp,
      discardIcpJob,
      removeMember,
      remove,
      getCached,
      put,
      mergeCached,
    ]
  );

  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>;
}

export function useWorkspaces(): WorkspacesValue {
  const value = useContext(WorkspacesContext);
  if (!value) throw new Error("useWorkspaces must be used within <WorkspacesProvider>.");
  return value;
}
