import Invitation from "../models/invitation.model.js";
import Workspace from "../models/workspace.model.js";
import User from "../models/user.model.js";
import { enqueueEmail } from "../utils/emailQueue.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("invitation.controller");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const canManage = (workspace, uid) => workspace.owner === uid;

/** Turn a Mongo CastError into a clean 404, matching workspace.controller.js. */
const notFoundOr500 = (res, error, req, operation) => {
    log.error(`${operation} failed`, {
        requestId: req?.id,
        uid: req?.user?.uid,
        workspaceId: req?.params?.workspaceId,
        invitationId: req?.params?.invitationId,
        error,
    });
    if (error?.name === "CastError") {
        return res.status(404).json({ error: "Invitation not found" });
    }
    return res.status(500).json({ error: error.message });
};

/** Strip the token before an invitation goes to a client. */
const publicInvite = (inv) => ({
    _id: inv._id,
    workspace: inv.workspace,
    email: inv.email,
    status: inv.status,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    respondedAt: inv.respondedAt ?? null,
});

/**
 * Best effort: the invitation row is the source of truth, so a Redis/queue
 * problem must not turn a successful invite into a 500. Returns the enqueue
 * result so the caller can tell the user the email didn't go out.
 */
async function sendInviteEmail({ to, workspaceName, inviterName, inviterEmail, token }, context = {}) {
    const link = `${CLIENT_URL}/invitations/${token}`;
    const inviter = inviterName || inviterEmail || "Someone";
    return enqueueEmail({
        to,
        subject: `${inviter} invited you to "${workspaceName}" on Signarion`,
        html: `
      <p>${inviter} invited you to join the <strong>${workspaceName}</strong> workspace on Signarion.</p>
      <p><a href="${link}">View invitation</a></p>
      <p>If you don't have a Signarion account yet, you can create one from that link — the invite will be waiting for you.</p>
    `,
    }, { kind: "invitation", ...context });
}

/* ------------------------------------------------------------------ */
/* workspace-scoped (owner manages invites for their workspace)         */
/* ------------------------------------------------------------------ */

const createInvitation = async (req, res) => {
    const OPERATION = "createInvitation";
    try {
        const email = (req.body?.email ?? "").trim().toLowerCase();
        if (!email || !EMAIL_RE.test(email)) {
            return res.status(400).json({ error: "Enter a valid email address" });
        }

        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canManage(workspace, req.user.uid)) {
            return res.status(403).json({ error: "Only the owner can invite members" });
        }
        if (email === (req.user.email ?? "").toLowerCase()) {
            return res.status(400).json({ error: "You're already the owner of this workspace" });
        }

        const existingUser = await User.findOne({ email }).select("firebaseUid").lean();
        if (existingUser && (workspace.members ?? []).includes(existingUser.firebaseUid)) {
            return res.status(409).json({ error: "That person is already a member" });
        }

        const pending = await Invitation.findOne({
            workspace: workspace._id,
            email,
            status: "pending",
        });
        if (pending) {
            return res
                .status(409)
                .json({ error: "An invite is already pending for that email", invitation: publicInvite(pending) });
        }

        const invitation = await Invitation.create({
            workspace: workspace._id,
            email,
            invitedBy: req.user.uid,
        });

        const inviter = await User.findOne({ firebaseUid: req.user.uid })
            .select("displayName email")
            .lean();
        const emailResult = await sendInviteEmail(
            {
                to: email,
                workspaceName: workspace.name,
                inviterName: inviter?.displayName,
                inviterEmail: inviter?.email ?? req.user.email,
                token: invitation.token,
            },
            { requestId: req.id, invitationId: String(invitation._id) },
        );

        log.info("invitation created", {
            requestId: req.id,
            invitationId: String(invitation._id),
            workspaceId: String(workspace._id),
            emailQueued: emailResult.ok,
        });

        res.status(201).json({
            message: emailResult.ok
                ? "Invitation sent"
                : "Invitation created, but the email could not be sent. Try resending it.",
            emailQueued: emailResult.ok,
            invitation: publicInvite(invitation),
        });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const listWorkspaceInvitations = async (req, res) => {
    const OPERATION = "listWorkspaceInvitations";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId).select("owner");
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canManage(workspace, req.user.uid)) {
            return res.status(403).json({ error: "Only the owner can view invitations" });
        }

        const invitations = await Invitation.find({ workspace: workspace._id, status: "pending" })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ invitations: invitations.map(publicInvite) });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const cancelInvitation = async (req, res) => {
    const OPERATION = "cancelInvitation";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId).select("owner");
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canManage(workspace, req.user.uid)) {
            return res.status(403).json({ error: "Only the owner can manage invitations" });
        }

        const invitation = await Invitation.findOneAndDelete({
            _id: req.params.invitationId,
            workspace: workspace._id,
        });
        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }

        res.status(200).json({ message: "Invitation cancelled" });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const resendInvitation = async (req, res) => {
    const OPERATION = "resendInvitation";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canManage(workspace, req.user.uid)) {
            return res.status(403).json({ error: "Only the owner can manage invitations" });
        }

        const invitation = await Invitation.findOne({
            _id: req.params.invitationId,
            workspace: workspace._id,
            status: "pending",
        });
        if (!invitation) {
            return res.status(404).json({ error: "Pending invitation not found" });
        }

        const inviter = await User.findOne({ firebaseUid: req.user.uid })
            .select("displayName email")
            .lean();
        const emailResult = await sendInviteEmail(
            {
                to: invitation.email,
                workspaceName: workspace.name,
                inviterName: inviter?.displayName,
                inviterEmail: inviter?.email ?? req.user.email,
                token: invitation.token,
            },
            { requestId: req.id, invitationId: String(invitation._id) },
        );

        if (!emailResult.ok) {
            log.error("invitation resend could not be queued", {
                requestId: req.id,
                invitationId: String(invitation._id),
                error: emailResult.error,
            });
            return res.status(503).json({ error: "Could not send the invitation email right now" });
        }

        log.info("invitation resent", { requestId: req.id, invitationId: String(invitation._id) });
        res.status(200).json({ message: "Invitation resent" });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

/* ------------------------------------------------------------------ */
/* invitee-facing                                                       */
/* ------------------------------------------------------------------ */

/** Public — no auth. Lets the emailed link show a preview before sign-in/sign-up. */
const getInvitationByToken = async (req, res) => {
    try {
        const invitation = await Invitation.findOne({ token: req.params.token })
            .populate("workspace", "name")
            .lean();
        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }

        const inviter = await User.findOne({ firebaseUid: invitation.invitedBy })
            .select("displayName email")
            .lean();

        res.status(200).json({
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                status: invitation.status,
                workspaceName: invitation.workspace?.name ?? "Workspace",
                invitedBy: {
                    displayName: inviter?.displayName ?? "",
                    email: inviter?.email ?? null,
                },
                createdAt: invitation.createdAt,
            },
        });
    } catch (error) {
        log.error("getInvitationByToken failed", { requestId: req.id, error });
        res.status(500).json({ error: error.message });
    }
};

/** Every pending invite addressed to the signed-in user's email. */
const listMyInvitations = async (req, res) => {
    try {
        const email = (req.user.email ?? "").toLowerCase();
        const invitations = await Invitation.find({ email, status: "pending" })
            .populate("workspace", "name trackedDomain")
            .sort({ createdAt: -1 })
            .lean();

        const inviterUids = [...new Set(invitations.map((i) => i.invitedBy))];
        const inviters = inviterUids.length
            ? await User.find({ firebaseUid: { $in: inviterUids } })
                  .select("firebaseUid displayName email")
                  .lean()
            : [];
        const inviterByUid = new Map(inviters.map((u) => [u.firebaseUid, u]));

        res.status(200).json({
            invitations: invitations
                .filter((i) => i.workspace) // guard against a deleted workspace's leftover invite
                .map((i) => ({
                    _id: i._id,
                    workspaceId: i.workspace._id,
                    workspaceName: i.workspace.name,
                    trackedDomain: i.workspace.trackedDomain ?? null,
                    invitedBy: {
                        displayName: inviterByUid.get(i.invitedBy)?.displayName ?? "",
                        email: inviterByUid.get(i.invitedBy)?.email ?? null,
                    },
                    createdAt: i.createdAt,
                })),
        });
    } catch (error) {
        log.error("listMyInvitations failed", { requestId: req.id, uid: req.user?.uid, error });
        res.status(500).json({ error: error.message });
    }
};

const acceptInvitation = async (req, res) => {
    const OPERATION = "acceptInvitation";
    try {
        const invitation = await Invitation.findById(req.params.invitationId);
        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }
        if (invitation.email !== (req.user.email ?? "").toLowerCase()) {
            return res.status(403).json({ error: "This invitation was sent to a different email address" });
        }
        if (invitation.status !== "pending") {
            return res.status(409).json({ error: `This invitation was already ${invitation.status}` });
        }

        const workspace = await Workspace.findById(invitation.workspace);
        if (!workspace) {
            invitation.status = "cancelled";
            await invitation.save();
            return res.status(404).json({ error: "That workspace no longer exists" });
        }

        if (workspace.owner !== req.user.uid && !(workspace.members ?? []).includes(req.user.uid)) {
            workspace.members.push(req.user.uid);
            await workspace.save();
        }
        await User.updateOne(
            { firebaseUid: req.user.uid },
            { $addToSet: { workspaces: workspace._id } },
        );

        invitation.status = "accepted";
        invitation.respondedAt = new Date();
        await invitation.save();

        res.status(200).json({ message: "Invitation accepted", workspaceId: workspace._id });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const declineInvitation = async (req, res) => {
    const OPERATION = "declineInvitation";
    try {
        const invitation = await Invitation.findById(req.params.invitationId);
        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }
        if (invitation.email !== (req.user.email ?? "").toLowerCase()) {
            return res.status(403).json({ error: "This invitation was sent to a different email address" });
        }
        if (invitation.status !== "pending") {
            return res.status(409).json({ error: `This invitation was already ${invitation.status}` });
        }

        invitation.status = "declined";
        invitation.respondedAt = new Date();
        await invitation.save();

        res.status(200).json({ message: "Invitation declined" });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

export {
    createInvitation,
    listWorkspaceInvitations,
    cancelInvitation,
    resendInvitation,
    getInvitationByToken,
    listMyInvitations,
    acceptInvitation,
    declineInvitation,
};
