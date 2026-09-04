import User from "../models/user.model.js";
import Workspace from "../models/workspace.model.js";
import { generateICPFromScrapedData } from "../utils/icpGenerator.js";
import { crawlEntireWebsite } from "../utils/scraper.js";

/** Owner or member (all are Firebase UID strings from req.user.uid). */
const canAccess = (workspace, uid) =>
    workspace.owner === uid || (workspace.members ?? []).includes(uid);

/** Turn a Mongo CastError on :workspaceId into a clean 404. */
const notFoundOr500 = (res, error) => {
    console.log(error);
    if (error?.name === "CastError") {
        return res.status(404).json({ error: "Workspace not found" });
    }
    return res.status(500).json({ error: error.message });
};

const getUserWorkspaces = async (req, res) => {
    try {
        const uid = req.user.uid;

        const [ownersWorkspaces, memberWorkspaces] = await Promise.all([
            Workspace.find({ owner: uid }).sort({ createdAt: -1 }),
            Workspace.find({ members: uid }).sort({ createdAt: -1 }),
        ]);

        res.status(200).json({ ownersWorkspaces, memberWorkspaces });
    } catch (error) {
        console.log(error);
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

        res.status(201).json({ message: "Workspace Initialised", workspace });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

const getWorkspaceDetails = async (req, res) => {
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canAccess(workspace, req.user.uid)) {
            return res.status(403).json({ error: "You don't have access to this workspace" });
        }
        res.status(200).json({ workspace });
    } catch (error) {
        return notFoundOr500(res, error);
    }
};

const updateWorkspace = async (req, res) => {
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
        if ("icp" in patch) workspace.markModified("icp"); // Mixed path needs an explicit nudge
        await workspace.save();

        res.status(200).json({ message: "Workspace updated", workspace });
    } catch (error) {
        return notFoundOr500(res, error);
    }
};

const addDomain = async (req, res) => {
    try {
        const rawDomain = (req.body?.domain ?? "").trim();
        if (!rawDomain) {
            return res.status(400).json({ error: "Domain is required" });
        }

        const workspaceId = req.params.workspaceId;
        const existing = await Workspace.findById(workspaceId);
        if (!existing) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (!canAccess(existing, req.user.uid)) {
            return res.status(403).json({ error: "You don't have access to this workspace" });
        }

        const domain = rawDomain
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0]
            .split("?")[0];

        const crawl = await crawlEntireWebsite(`https://${domain}`, { maxPages: 25 });
        const generatedIcp = await generateICPFromScrapedData(crawl.aggregatedContent, domain);

        // Persist the domain, but NOT the ICP — the client shows the draft in a
        // JSON editor first and saves it (as-is or edited) via PATCH /:id { icp }.
        const workspace = await Workspace.findByIdAndUpdate(
            workspaceId,
            { trackedDomain: domain },
            { new: true },
        );

        res.status(200).json({ message: "Domain analyzed", workspace, generatedIcp });
    } catch (error) {
        return notFoundOr500(res, error);
    }
};

const deleteWorkspace = async (req, res) => {
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ error: "Workspace not found" });
        }
        if (workspace.owner !== req.user.uid) {
            return res.status(403).json({ error: "Only the owner can delete this workspace" });
        }

        await workspace.deleteOne();
        await User.updateMany(
            { workspaces: workspace._id },
            { $pull: { workspaces: workspace._id } },
        );

        res.status(200).json({ message: "Workspace deleted", workspace });
    } catch (error) {
        return notFoundOr500(res, error);
    }
};

export {
    getUserWorkspaces,
    createWorkspace,
    addDomain,
    getWorkspaceDetails,
    updateWorkspace,
    deleteWorkspace,
};
