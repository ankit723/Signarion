import Router from "express"
import authenticate from "../middlewares/auth.middleware.js"
import {
  createWorkspace,
  deleteWorkspace,
  discardIcpJob,
  getIcpJob,
  getUserWorkspaces,
  getWorkspaceDetails,
  removeMember,
  startAnalysis,
  updateWorkspace,
} from "../controllers/workspace.controller.js"
import {
  cancelInvitation,
  createInvitation,
  listWorkspaceInvitations,
  resendInvitation,
} from "../controllers/invitation.controller.js"

const workspaceRoutes = Router()

workspaceRoutes.get("/", authenticate, getUserWorkspaces) //get all workspaces
workspaceRoutes.post("/", authenticate, createWorkspace) //create workspace

workspaceRoutes.delete("/:workspaceId/members/:memberUid", authenticate, removeMember) //remove member / leave

workspaceRoutes.post("/:workspaceId/invitations", authenticate, createInvitation) //invite by email
workspaceRoutes.get("/:workspaceId/invitations", authenticate, listWorkspaceInvitations) //pending invites
workspaceRoutes.delete("/:workspaceId/invitations/:invitationId", authenticate, cancelInvitation) //cancel invite
workspaceRoutes.post("/:workspaceId/invitations/:invitationId/resend", authenticate, resendInvitation) //resend

workspaceRoutes.get("/:workspaceId/icp-job", authenticate, getIcpJob) //poll analysis status
workspaceRoutes.delete("/:workspaceId/icp-job", authenticate, discardIcpJob) //discard the draft

workspaceRoutes.get("/:workspaceId", authenticate, getWorkspaceDetails) //details (incl. icp + members)
workspaceRoutes.patch("/:workspaceId", authenticate, updateWorkspace) //rename / save icp
workspaceRoutes.put("/:workspaceId", authenticate, startAnalysis) //start background analysis
workspaceRoutes.delete("/:workspaceId", authenticate, deleteWorkspace) //delete workspace


export default workspaceRoutes
