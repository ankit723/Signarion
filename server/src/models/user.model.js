import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    displayName: {
      type: String,
      default: "",
      trim: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    metadata: {
      creationTime: {
        type: Date,
      },

      lastSignInTime: {
        type: Date,
        default: null,
      },
    },

    workspaces: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;