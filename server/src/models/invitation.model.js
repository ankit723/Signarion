import mongoose from "mongoose";
import crypto from "crypto";

const invitationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    // Lowercased so lookups (by invitee email, or on signup) are consistent.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Firebase UID of the workspace owner who sent the invite.
    invitedBy: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },

    // Opaque id used in the emailed link — lets someone open the invite
    // before they even have an account.
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// One live invite per (workspace, email) at a time.
invitationSchema.index({ workspace: 1, email: 1, status: 1 });

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;
