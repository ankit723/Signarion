import Invitation from "../models/invitation.model.js";
import Workspace from "../models/workspace.model.js";
import User from "../models/user.model.js";
import emailQueue from "../utils/emailQueue.js";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const canManage = (workspace, uid) => workspace.owner === uid;

/** Turn a Mongo CastError into a clean 404, matching workspace.controller.js. */
const notFoundOr500 = (res, error) => {
    console.log(error);
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

async function sendInviteEmail({ to, workspaceName, inviterName, inviterEmail, token }) {
    const link = `${CLIENT_URL}/invitations/${token}`;
    const inviter = inviterName || inviterEmail || "Someone";
    await emailQueue.add("sendEmail", {
        to,
        subject: `${inviter} invited you to "${workspaceName}" on Signarion`,
        html: `
      <p>${inviter} invited you to join the <strong>${workspaceName}</strong> workspace on Signarion.</p>
      <p><a href="${link}">View invitation</a></p>
      <p>If you don't have a Signarion account yet, you can create one from that link — the invite will be waiting for you.</p>
    `,
    });
}

/* ------------------------------------------------------------------ */
/* workspace-scoped (owner manages invites for their workspace)         */
/* ------------------------------------------------------------------ */

const createInvitation = async (req, res) => {
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
        sendInviteEmail({
            to: email,
            workspaceName: workspace.name,
            inviterName: inviter?.displayName,
            inviterEmail: inviter?.email ?? req.user.email,
            token: invitation.token,
        }).catch((err) => console.error("[invitations] failed to send invite email:", err.message));

        res.status(201).json({ message: "Invitation sent", invitation: publicInvite(invitation) });
    } catch (error) {
        return notFoundOr500(res, error);
    }
};

const listWorkspaceInvitations = async (req, res) => {
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
        return notFoundOr500(res, error);
    }
};

const cancelInvitation = async (req, res) => {
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
        return notFoundOr500(res, error);
    }
};

const resendInvitation = async (req, res) => {
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
        await sendInviteEmail({
            to: invitation.email,
            workspaceName: workspace.name,
            inviterName: inviter?.displayName,
            inviterEmail: inviter?.email ?? req.user.email,
            token: invitation.token,
        });

        res.status(200).json({ message: "Invitation resent" });
    } catch (error) {
        return notFoundOr500(res, error);
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
        console.log(error);
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
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

const acceptInvitation = async (req, res) => {
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
        return notFoundOr500(res, error);
    }
};

const declineInvitation = async (req, res) => {
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
        return notFoundOr500(res, error);
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
