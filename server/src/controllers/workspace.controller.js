import User from "../models/user.model.js";
import Workspace from "../models/workspace.model.js";
import { enqueueIcpJob, removeIcpJob } from "../utils/icpQueue.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("workspace.controller");

/** Owner or member (all are Firebase UID strings from req.user.uid). */
const canAccess = (workspace, uid) =>
    workspace.owner === uid || (workspace.members ?? []).includes(uid);

/** Turn a Mongo CastError on :workspaceId into a clean 404. */
const notFoundOr500 = (res, error, req, operation) => {
    log.error(`${operation} failed`, {
        requestId: req?.id,
        uid: req?.user?.uid,
        workspaceId: req?.params?.workspaceId,
        error,
    });
    if (error?.name === "CastError") {
        return res.status(404).json({ error: "Workspace not found" });
    }
    return res.status(500).json({ error: error.message });
};

const IDLE_JOB = {
    status: "idle",
    domain: null,
    stage: null,
    draft: null,
    error: null,
    startedAt: null,
    finishedAt: null,
};

/** Resolve owner + member Firebase UIDs into { uid, email, displayName, role }. */
const resolveMembers = async (workspace) => {
    const uids = [workspace.owner, ...(workspace.members ?? [])];
    const users = await User.find({ firebaseUid: { $in: uids } })
        .select("firebaseUid email displayName")
        .lean();
    const byUid = new Map(users.map((u) => [u.firebaseUid, u]));
    return uids.map((uid) => {
        const u = byUid.get(uid);
        return {
            uid,
            email: u?.email ?? null,
            displayName: u?.displayName ?? "",
            role: uid === workspace.owner ? "owner" : "member",
        };
    });
};

const getUserWorkspaces = async (req, res) => {
    try {
        const uid = req.user.uid;

        // The draft can be large — the list doesn't need it (only the poll does).
        const [ownersWorkspaces, memberWorkspaces] = await Promise.all([
            Workspace.find({ owner: uid }).select("-icpJob.draft").sort({ createdAt: -1 }).lean(),
            Workspace.find({ members: uid }).select("-icpJob.draft").sort({ createdAt: -1 }).lean(),
        ]);

        // The dashboard shows who owns a shared workspace — resolve those owners.
        const ownerUids = [...new Set(memberWorkspaces.map((w) => w.owner))];
        const owners = ownerUids.length
            ? await User.find({ firebaseUid: { $in: ownerUids } })
                  .select("firebaseUid email displayName")
                  .lean()
            : [];
        const ownerByUid = new Map(owners.map((u) => [u.firebaseUid, u]));
        const memberWorkspacesWithOwner = memberWorkspaces.map((w) => ({
            ...w,
            ownerInfo: {
                email: ownerByUid.get(w.owner)?.email ?? null,
                displayName: ownerByUid.get(w.owner)?.displayName ?? "",
            },
        }));

        log.info("workspaces listed", {
            requestId: req.id,
            uid,
            owned: ownersWorkspaces.length,
            member: memberWorkspacesWithOwner.length,
        });
        res.status(200).json({ ownersWorkspaces, memberWorkspaces: memberWorkspacesWithOwner });
    } catch (error) {
        log.error("getUserWorkspaces failed", { requestId: req.id, uid: req.user?.uid, error });
        res.status(500).json({ error: error.message });
    }
};

const createWorkspace = async (req, res) => {
    try {
        const name = (req.body?.name ?? "").trim();
        if (!name) {
            return res.status(400).json({ error: "Workspace name is required" });
        }

        const workspace = await Workspace.create({
            name,
            owner: req.user.uid,
            members: [],
        });

        // Keep the User -> workspaces back-reference in sync.
        await User.updateOne(
            { firebaseUid: req.user.uid },
            { $addToSet: { workspaces: workspace._id } },
        );

        log.info("workspace created", {
            requestId: req.id,
            uid: req.user.uid,
            workspaceId: String(workspace._id),
        });
        res.status(201).json({ message: "Workspace Initialised", workspace });
    } catch (error) {
        log.error("createWorkspace failed", { requestId: req.id, uid: req.user?.uid, error });
        res.status(500).json({ error: error.message });
    }
};

const getWorkspaceDetails = async (req, res) => {
    const OPERATION = "getWorkspaceDetails";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canAccess(workspace, req.user.uid)) {
            return res.status(403).json({ error: "You don't have access to this workspace" });
        }
        const members = await resolveMembers(workspace);
        res.status(200).json({ workspace, members });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const removeMember = async (req, res) => {
    const OPERATION = "removeMember";
    try {
        const targetUid = req.params.memberUid;

        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        // The owner can remove anyone; a member can remove only themselves.
        const isOwner = workspace.owner === req.user.uid;
        if (!isOwner && targetUid !== req.user.uid) {
            return res.status(403).json({ error: "Only the owner can remove other members" });
        }
        if (targetUid === workspace.owner) {
            return res.status(400).json({ error: "The owner can't be removed" });
        }

        workspace.members = (workspace.members ?? []).filter((m) => m !== targetUid);
        await workspace.save();
        await User.updateOne(
            { firebaseUid: targetUid },
            { $pull: { workspaces: workspace._id } },
        );

        const members = await resolveMembers(workspace);
        res.status(200).json({ message: "Member removed", workspace, members });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const updateWorkspace = async (req, res) => {
    const OPERATION = "updateWorkspace";
    try {
        const { name, icp } = req.body ?? {};

        const patch = {};
        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) {
                return res.status(400).json({ error: "Workspace name is required" });
            }
            patch.name = trimmed;
        }
        if (icp !== undefined) {
            if (icp === null || typeof icp !== "object" || Array.isArray(icp)) {
                return res.status(400).json({ error: "ICP must be a JSON object" });
            }
            patch.icp = icp;
        }
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: "Nothing to update" });
        }

        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (workspace.owner !== req.user.uid) {
            return res.status(403).json({ error: "Only the owner can update this workspace" });
        }

        Object.assign(workspace, patch);
        if ("icp" in patch) {
            workspace.markModified("icp"); // Mixed path needs an explicit nudge
            // Saving the reviewed ICP clears the "ready to review" draft.
            if (workspace.icpJob?.status === "ready") {
                workspace.icpJob = { ...IDLE_JOB };
            }
        }
        await workspace.save();

        res.status(200).json({ message: "Workspace updated", workspace });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

/**
 * Start (or restart) domain analysis. Returns immediately — the crawl + model
 * run on a BullMQ worker and write the result to `workspace.icpJob`.
 */
const startAnalysis = async (req, res) => {
    const OPERATION = "startAnalysis";
    try {
        const rawDomain = (req.body?.domain ?? "").trim();
        if (!rawDomain) {
            return res.status(400).json({ error: "Domain is required" });
        }

        const workspaceId = req.params.workspaceId;
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canAccess(workspace, req.user.uid)) {
            return res.status(403).json({ error: "You don't have access to this workspace" });
        }

        const current = workspace.icpJob?.status;
        if (current === "queued" || current === "running") {
            return res
                .status(409)
                .json({ error: "An analysis is already in progress", workspace });
        }

        const domain = rawDomain
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]
            .split("?")[0];

        workspace.trackedDomain = domain;
        workspace.icpJob = {
            status: "queued",
            domain,
            stage: "Queued",
            draft: null,
            error: null,
            startedAt: new Date(),
            finishedAt: null,
        };
        await workspace.save();

        try {
            await enqueueIcpJob(workspaceId, domain);
        } catch (error) {
            // The workspace is already marked "queued" — without this rollback a
            // Redis outage leaves it stuck there with no worker ever picking it up.
            log.error("failed to enqueue analysis — rolling icpJob back to failed", {
                requestId: req.id,
                workspaceId,
                domain,
                error,
            });
            workspace.icpJob = {
                ...IDLE_JOB,
                status: "failed",
                domain,
                error: "Could not start the analysis. Please try again.",
                finishedAt: new Date(),
            };
            await workspace.save().catch((saveError) =>
                log.error("rollback save failed", { requestId: req.id, workspaceId, error: saveError }),
            );
            return res
                .status(503)
                .json({ error: "Analysis service is unavailable right now", workspace });
        }

        log.info("analysis queued", { requestId: req.id, workspaceId, domain, uid: req.user.uid });
        res.status(202).json({ message: "Analysis started", workspace });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

/** Lightweight poll target for the running analysis. */
const getIcpJob = async (req, res) => {
    const OPERATION = "getIcpJob";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId).select(
            "owner members icpJob",
        );
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canAccess(workspace, req.user.uid)) {
            return res.status(403).json({ error: "You don't have access to this workspace" });
        }
        res.status(200).json({ icpJob: workspace.icpJob ?? { ...IDLE_JOB } });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

/** Drop a finished/failed draft (or cancel a still-queued job). */
const discardIcpJob = async (req, res) => {
    const OPERATION = "discardIcpJob";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canAccess(workspace, req.user.uid)) {
            return res.status(403).json({ error: "You don't have access to this workspace" });
        }

        const status = workspace.icpJob?.status;
        if (status === "running") {
            return res
                .status(409)
                .json({ error: "The analysis is still running — wait for it to finish", workspace });
        }
        if (status === "queued") {
            await removeIcpJob(workspace._id);
        }

        workspace.icpJob = { ...IDLE_JOB };
        await workspace.save();

        res.status(200).json({ message: "Draft discarded", workspace });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

const deleteWorkspace = async (req, res) => {
    const OPERATION = "deleteWorkspace";
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (workspace.owner !== req.user.uid) {
            return res.status(403).json({ error: "Only the owner can delete this workspace" });
        }

        await removeIcpJob(workspace._id);
        await workspace.deleteOne();
        await User.updateMany(
            { workspaces: workspace._id },
            { $pull: { workspaces: workspace._id } },
        );

        res.status(200).json({ message: "Workspace deleted", workspace });
    } catch (error) {
        return notFoundOr500(res, error, req, OPERATION);
    }
};

export {
    getUserWorkspaces,
    createWorkspace,
    startAnalysis,
    getIcpJob,
    discardIcpJob,
    getWorkspaceDetails,
    updateWorkspace,
    deleteWorkspace,
    removeMember,
};
