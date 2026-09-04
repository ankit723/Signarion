import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Firebase UID of the creator (matches req.user.uid from the auth middleware).
    owner: {
        type: String,
        required: true,
    },

    // Firebase UIDs of additional members.
    members: {
        type: [String],
        default: [],
    },

    trackedDomain: {
        type: String
    },

    connectedEmails: {
      type: [String],
      default: [],
    },

    connectedLinkedin: {
      type: String,
      default: null,
    },

    icp: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Background ICP-generation job. The crawl + model run in a BullMQ worker,
    // so it keeps going even if the user closes the tab. When `status: "ready"`
    // the `draft` holds the generated ICP awaiting the user's review.
    icpJob: {
      status: {
        type: String,
        enum: ["idle", "queued", "running", "ready", "failed"],
        default: "idle",
      },
      domain: { type: String, default: null },
      stage: { type: String, default: null },
      draft: { type: mongoose.Schema.Types.Mixed, default: null },
      error: { type: String, default: null },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;
