import { Router } from "express";
import authenticate from "../middlewares/auth.middleware.js";
import {
  acceptInvitation,
  declineInvitation,
  getInvitationByToken,
  listMyInvitations,
} from "../controllers/invitation.controller.js";

const invitationRoutes = Router();

// Public — the emailed link resolves this before the visitor is signed in.
invitationRoutes.get("/token/:token", getInvitationByToken);

invitationRoutes.get("/", authenticate, listMyInvitations);
invitationRoutes.post("/:invitationId/accept", authenticate, acceptInvitation);
invitationRoutes.post("/:invitationId/decline", authenticate, declineInvitation);

export default invitationRoutes;
