export type InvitationStatus = "pending" | "accepted" | "declined" | "cancelled";

/** As the workspace owner sees their own sent invites. */
export interface WorkspaceInvitation {
  _id: string;
  workspace: string;
  email: string;
  status: InvitationStatus;
  createdAt: string;
  updatedAt?: string;
  respondedAt?: string | null;
}

export interface InvitationInviter {
  displayName: string;
  email: string | null;
}

/** A pending invitation addressed to the signed-in user. */
export interface MyInvitation {
  _id: string;
  workspaceId: string;
  workspaceName: string;
  trackedDomain: string | null;
  invitedBy: InvitationInviter;
  createdAt: string;
}

/** Public preview (no auth) shown from the emailed link before sign-in. */
export interface InvitationPreview {
  _id: string;
  email: string;
  status: InvitationStatus;
  workspaceName: string;
  invitedBy: InvitationInviter;
  createdAt: string;
}
