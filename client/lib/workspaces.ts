/**
 * Workspace API. Talks to the Express API mounted at /api/workspace
 * (server/src/routes/workspace.routes.js) through the shared axios instance,
 * so auth headers + 401 refresh are handled for us.
 */
import api, { apiError } from "@/lib/api";
import type { Icp, Workspace } from "@/types/workspace";

export interface DomainAnalysis {
  workspace: Workspace;
  /** The AI draft. Not saved yet — the user reviews/edits it, then it's saved. */
  generatedIcp: Icp;
}

/** Domain analysis crawls the site + runs the ICP model — it needs a long leash. */
const DOMAIN_ANALYSIS_TIMEOUT = 240_000;

interface ListResponse {
  ownersWorkspaces?: Workspace[];
  memberWorkspaces?: Workspace[];
}

function tag(list: Workspace[] | undefined, role: Workspace["role"]): Workspace[] {
  return (list ?? []).map((w) => ({ ...w, role }));
}

export const workspaceApi = {
  /** Owner + member workspaces, merged and de-duplicated (owner wins). */
  async list(): Promise<Workspace[]> {
    try {
      const { data } = await api.get<ListResponse>("/workspace");
      const byId = new Map<string, Workspace>();
      for (const w of tag(data.memberWorkspaces, "member")) byId.set(w._id, w);
      for (const w of tag(data.ownersWorkspaces, "owner")) byId.set(w._id, w);
      return [...byId.values()].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async get(id: string): Promise<Workspace> {
    try {
      const { data } = await api.get<{ workspace: Workspace | null }>(`/workspace/${id}`);
      if (!data.workspace) throw new Error("Workspace not found.");
      return { ...data.workspace, role: data.workspace.role ?? "owner" };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async create(name: string): Promise<Workspace> {
    try {
      const { data } = await api.post<{ workspace: Workspace }>("/workspace", {
        name: name.trim(),
      });
      return { ...data.workspace, role: "owner" };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async update(id: string, name: string): Promise<Workspace> {
    try {
      const { data } = await api.patch<{ workspace: Workspace }>(`/workspace/${id}`, {
        name: name.trim(),
      });
      return { ...data.workspace, role: data.workspace.role ?? "owner" };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  /** Save an ICP object (an AI draft accepted as-is, or an edited version). */
  async saveIcp(id: string, icp: Icp): Promise<Workspace> {
    try {
      const { data } = await api.patch<{ workspace: Workspace }>(`/workspace/${id}`, { icp });
      return { ...data.workspace, role: data.workspace.role ?? "owner" };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  /**
   * Attach a domain and run crawl + ICP generation. Resolves with the updated
   * workspace (domain saved) and the AI ICP draft — which is NOT persisted yet.
   */
  async addDomain(id: string, domain: string): Promise<DomainAnalysis> {
    try {
      const { data } = await api.put<{ workspace: Workspace; generatedIcp?: Icp }>(
        `/workspace/${id}`,
        { domain: normalizeDomain(domain) },
        { timeout: DOMAIN_ANALYSIS_TIMEOUT }
      );
      return {
        workspace: { ...data.workspace, role: data.workspace.role ?? "owner" },
        generatedIcp: (data.generatedIcp ?? {}) as Icp,
      };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await api.delete(`/workspace/${id}`);
    } catch (err) {
      throw new Error(apiError(err));
    }
  },
};

/** Strip protocol / path / query so the server gets a bare hostname. */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  value = value.split("/")[0].split("?")[0].split("#")[0];
  return value;
}

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function checkDomain(value: string): string | undefined {
  const domain = normalizeDomain(value);
  if (!domain) return "Enter a domain to analyze.";
  if (!DOMAIN_RE.test(domain)) return "Enter a valid domain, e.g. acme.com.";
}

export function checkWorkspaceName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "Give your workspace a name.";
  if (name.length < 2) return "That name is too short.";
  if (name.length > 60) return "Keep the name under 60 characters.";
}
