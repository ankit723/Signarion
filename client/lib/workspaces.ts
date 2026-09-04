/**
 * Workspace API. Talks to the Express API mounted at /api/workspace
 * (server/src/routes/workspace.routes.js) through the shared axios instance,
 * so auth headers + 401 refresh are handled for us.
 */
import api, { apiError } from "@/lib/api";
import type { Icp, IcpJob, Workspace, WorkspaceMember } from "@/types/workspace";

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
      const { data } = await api.get<{
        workspace: Workspace | null;
        members?: WorkspaceMember[];
      }>(`/workspace/${id}`);
      if (!data.workspace) throw new Error("Workspace not found.");
      return {
        ...data.workspace,
        role: data.workspace.role ?? "owner",
        resolvedMembers: data.members ?? [],
      };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  /** Invite by email — see `@/lib/invitations` for the invitation lifecycle. */
  async removeMember(id: string, memberUid: string): Promise<Workspace> {
    try {
      const { data } = await api.delete<{ workspace: Workspace; members: WorkspaceMember[] }>(
        `/workspace/${id}/members/${encodeURIComponent(memberUid)}`
      );
      return {
        ...data.workspace,
        role: data.workspace.role ?? "owner",
        resolvedMembers: data.members ?? [],
      };
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
   * Kick off background domain analysis. Returns fast — the crawl + model run on
   * the server and write to `workspace.icpJob`; poll `getIcpJob` for progress.
   */
  async startAnalysis(id: string, domain: string): Promise<Workspace> {
    try {
      const { data } = await api.put<{ workspace: Workspace }>(`/workspace/${id}`, {
        domain: normalizeDomain(domain),
      });
      return { ...data.workspace, role: data.workspace.role ?? "owner" };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  /** Poll the running analysis (light — no draft in the list / details payloads). */
  async getIcpJob(id: string): Promise<IcpJob> {
    try {
      const { data } = await api.get<{ icpJob: IcpJob }>(`/workspace/${id}/icp-job`);
      return data.icpJob ?? { status: "idle" };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  /** Throw away a finished / failed draft (or cancel a queued job). */
  async discardIcpJob(id: string): Promise<Workspace> {
    try {
      const { data } = await api.delete<{ workspace: Workspace }>(`/workspace/${id}/icp-job`);
      return { ...data.workspace, role: data.workspace.role ?? "owner" };
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
