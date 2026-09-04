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
  },
  {
    timestamps: true,
  },
);

const Workspace = mongoose.model("Workspace", workspaceSchema);

export default Workspace;
