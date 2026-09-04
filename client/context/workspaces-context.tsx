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
import { workspaceApi, type DomainAnalysis } from "@/lib/workspaces";
import type { Icp, Workspace } from "@/types/workspace";

type ListStatus = "idle" | "loading" | "ready" | "error";

interface WorkspacesValue {
  items: Workspace[];
  status: ListStatus;
  error: string | null;
  /** `true` while re-fetching in the background (list already shown). */
  refreshing: boolean;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Workspace>;
  update: (id: string, name: string) => Promise<Workspace>;
  /** Analyze a domain. Returns the AI ICP draft — call `saveIcp` to persist it. */
  addDomain: (id: string, domain: string) => Promise<DomainAnalysis>;
  /** Persist an ICP (AI draft as-is, or edited). */
  saveIcp: (id: string, icp: Icp) => Promise<Workspace>;
  remove: (id: string) => Promise<void>;
  /** Read one from the cache without a request. */
  getCached: (id: string) => Workspace | undefined;
  /** Merge a freshly fetched workspace into the cache. */
  put: (workspace: Workspace) => void;
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

  // Load once the user is authenticated. No teardown needed: this provider only
  // lives under /dashboard, and signing out navigates away and unmounts it.
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

  const addDomain = useCallback(
    async (id: string, domain: string) => {
      const result = await workspaceApi.addDomain(id, domain);
      put(result.workspace); // domain is saved now; the ICP still needs review
      return result;
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

  const remove = useCallback(async (id: string) => {
    const snapshot = { done: false };
    setItems((current) => current.filter((w) => w._id !== id));
    try {
      await workspaceApi.remove(id);
      snapshot.done = true;
    } finally {
      // If the delete failed, pull the truth back from the server.
      if (!snapshot.done) void load();
    }
  }, [load]);

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
      addDomain,
      saveIcp,
      remove,
      getCached,
      put,
    }),
    [items, status, error, refreshing, load, create, update, addDomain, saveIcp, remove, getCached, put]
  );

  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>;
}

export function useWorkspaces(): WorkspacesValue {
  const value = useContext(WorkspacesContext);
  if (!value) throw new Error("useWorkspaces must be used within <WorkspacesProvider>.");
  return value;
}
