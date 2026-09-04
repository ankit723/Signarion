/**
 * Invitation API. Owner-side calls live under /api/workspace/:id/invitations
 * (server/src/routes/workspace.routes.js); invitee-side calls live under
 * /api/invitations (server/src/routes/invitation.routes.js).
 */
import api, { apiError } from "@/lib/api";
import type { InvitationPreview, MyInvitation, WorkspaceInvitation } from "@/types/invitation";

export const invitationApi = {
  // ---- Owner: manage invites for one workspace ------------------------

  async create(workspaceId: string, email: string): Promise<WorkspaceInvitation> {
    try {
      const { data } = await api.post<{ invitation: WorkspaceInvitation }>(
        `/workspace/${workspaceId}/invitations`,
        { email: email.trim() }
      );
      return data.invitation;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async listForWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    try {
      const { data } = await api.get<{ invitations: WorkspaceInvitation[] }>(
        `/workspace/${workspaceId}/invitations`
      );
      return data.invitations;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async cancel(workspaceId: string, invitationId: string): Promise<void> {
    try {
      await api.delete(`/workspace/${workspaceId}/invitations/${invitationId}`);
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async resend(workspaceId: string, invitationId: string): Promise<void> {
    try {
      await api.post(`/workspace/${workspaceId}/invitations/${invitationId}/resend`);
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  // ---- Invitee: respond to invites addressed to me ---------------------

  async listMine(): Promise<MyInvitation[]> {
    try {
      const { data } = await api.get<{ invitations: MyInvitation[] }>("/invitations");
      return data.invitations;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  /** Public — works before sign-in, for the link in the invite email. */
  async getByToken(token: string): Promise<InvitationPreview> {
    try {
      const { data } = await api.get<{ invitation: InvitationPreview }>(
        `/invitations/token/${encodeURIComponent(token)}`
      );
      return data.invitation;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async accept(invitationId: string): Promise<{ workspaceId: string }> {
    try {
      const { data } = await api.post<{ workspaceId: string }>(
        `/invitations/${invitationId}/accept`
      );
      return { workspaceId: data.workspaceId };
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  async decline(invitationId: string): Promise<void> {
    try {
      await api.post(`/invitations/${invitationId}/decline`);
    } catch (err) {
      throw new Error(apiError(err));
    }
  },
};
