"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspaces } from "@/context/workspaces-context";
import { workspaceApi } from "@/lib/workspaces";
import type { Workspace } from "@/types/workspace";

/**
 * Hydrates the full workspace record (members, freshest ICP) once per id.
 * The list cache only carries the summary shown on cards, so both the detail
 * page and the settings page — either of which can be landed on directly —
 * fetch the details endpoint themselves and share the result via the
 * workspaces context cache.
 */
export function useWorkspaceDetail(id: string) {
  const { status, getCached, put } = useWorkspaces();
  const cached = getCached(id);
  const [fetched, setFetched] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || notFound || status !== "ready") return;
    hydratedRef.current = true;
    let alive = true;
    workspaceApi
      .get(id)
      .then((w) => {
        if (alive) {
          setFetched(w);
          put(w);
        }
      })
      .catch(() => {
        if (alive && !getCached(id)) setNotFound(true);
      });
    return () => {
      alive = false;
    };
  }, [id, notFound, status, put, getCached]);

  return { workspace: cached ?? fetched, notFound, setFetched };
}
