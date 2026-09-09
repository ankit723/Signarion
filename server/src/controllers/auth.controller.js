import { auth } from "../utils/firebase.js";
import { cacheDel } from "../utils/redis.js";
import User from "../models/user.model.js";
import Workspace from "../models/workspace.model.js";
import Invitation from "../models/invitation.model.js";
import { enqueueEmail } from "../utils/emailQueue.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("auth.controller");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const SESSION_TTL_SECONDS = 86400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const actionCodeSettings = {
  url: `${CLIENT_URL}/auth/action`,
  handleCodeInApp: true,
};

/**
 * Firebase Admin returns an action link that points at the Firebase-hosted
 * handler. We only need the one-time `oobCode` from it so the whole
 * verify / reset experience can live inside our own client UI.
 */
const buildAppActionLink = (firebaseLink, mode) => {
  try {
    const oobCode = new URL(firebaseLink).searchParams.get("oobCode");
    if (!oobCode) return firebaseLink;
    return `${CLIENT_URL}/auth/action?mode=${mode}&oobCode=${encodeURIComponent(
      oobCode
    )}`;
  } catch {
    return firebaseLink;
  }
};

const register = async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email & password required" });

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || "",
    });

    const newUser = await User.create({
      firebaseUid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName || "",
      metadata: {creationTime: userRecord.metadata.creationTime, lastSignInTime: userRecord.metadata.lastSignInTime},
    });

    const firebaseLink = await auth.generateEmailVerificationLink(
      email,
      actionCodeSettings
    );
    const verificationLink = buildAppActionLink(firebaseLink, "verifyEmail");

    // Best effort: the account exists either way, so a queue outage must not
    // turn a successful signup into a 500.
    const emailResult = await enqueueEmail(
      {
        to: email,
        subject: "Verify your email",
        html: `<p>Welcome! Confirm your email address by clicking <a href="${verificationLink}">this link</a>.</p>`,
      },
      { requestId: req.id, kind: "verifyEmail", uid: userRecord.uid },
    );

    log.info("account registered", {
      requestId: req.id,
      uid: userRecord.uid,
      email,
      verificationEmailQueued: emailResult.ok,
    });

    return res.status(201).json({
      message: emailResult.ok
        ? "Account created. Check your inbox to verify your email."
        : "Account created, but we couldn't send the verification email. Request a new one from your account settings.",
      verificationEmailQueued: emailResult.ok,
      user: newUser,
    });
  } catch (error) {
    log.error("register failed", { requestId: req.id, email, code: error?.code, error });
    if (error.code === "auth/email-already-exists") {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }
    if (error.code === "auth/invalid-password") {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }
    return res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log.warn("login rejected: missing bearer token", { requestId: req.id });
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const userRecord = await auth.getUser(decodedToken.uid);

    const sessionData = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || "",
      emailVerified: userRecord.emailVerified,
    };

    log.info("login succeeded", { requestId: req.id, uid: userRecord.uid });
    return res.status(200).json({ message: "Authenticated successfully", user: sessionData });
  } catch (error) {
    log.warn("login failed", { requestId: req.id, code: error?.code, error: error?.message });
    return res.status(401).json({ error: "Invalid token" });
  }
};

const me = async (req, res) => {
  try {
    // Read live every time. `/me` is low-frequency (roughly once per page load),
    // and caching it in Redis meant manual DB / Firebase edits took up to
    // SESSION_TTL_SECONDS to show up.
    const [dbUser, userRecord] = await Promise.all([
      User.findOne({ firebaseUid: req.user.uid }),
      auth.getUser(req.user.uid),
    ]);

    const userProfile = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: dbUser?.displayName || userRecord.displayName || "",
      emailVerified: userRecord.emailVerified,
      metadata: userRecord.metadata,
    };

    if (!dbUser) {
      log.warn("no Mongo profile for authenticated user", {
        requestId: req.id,
        uid: req.user.uid,
      });
    }

    return res.status(200).json({ user: userProfile });
  } catch (error) {
    log.error("me failed", { requestId: req.id, uid: req.user?.uid, code: error?.code, error });
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const genericResponse = {
    message: "If an account exists for that email, a reset link is on its way.",
  };

  try {
    const firebaseLink = await auth.generatePasswordResetLink(
      email,
      actionCodeSettings
    );
    const resetLink = buildAppActionLink(firebaseLink, "resetPassword");

    const emailResult = await enqueueEmail(
      {
        to: email,
        subject: "Reset your password",
        html: `<p>We received a request to reset your password. Click <a href="${resetLink}">this link</a> to choose a new one. If you didn't ask for this, you can ignore this email.</p>`,
      },
      { requestId: req.id, kind: "resetPassword" },
    );

    log.info("password reset requested", { requestId: req.id, email, queued: emailResult.ok });
    return res.status(200).json(genericResponse);
  } catch (error) {
    // The response stays generic so we never reveal whether the account exists,
    // but the log records what actually went wrong.
    log.warn("forgotPassword failed (responding generically)", {
      requestId: req.id,
      email,
      code: error?.code,
      error: error?.message,
    });
    return res.status(200).json(genericResponse);
  }
};

const verify = async (req, res) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRecord = await auth.getUser(req.user.uid);
    if (userRecord.emailVerified) {
      if (!dbUser.isEmailVerified) {
        dbUser.isEmailVerified = true;
        await dbUser.save();
      }
      return res.status(400).json({ error: "Email already verified" });
    }

    const firebaseLink = await auth.generateEmailVerificationLink(
      dbUser.email,
      actionCodeSettings
    );
    const verificationLink = buildAppActionLink(firebaseLink, "verifyEmail");

    const emailResult = await enqueueEmail(
      {
        to: dbUser.email,
        subject: "Verify your email",
        html: `<p>Confirm your email address by clicking <a href="${verificationLink}">this link</a>.</p>`,
      },
      { requestId: req.id, kind: "verifyEmail", uid: req.user.uid },
    );

    if (!emailResult.ok) {
      log.error("verification email could not be queued", {
        requestId: req.id,
        uid: req.user.uid,
        error: emailResult.error,
      });
      return res.status(503).json({ error: "Could not send the verification email right now" });
    }

    log.info("verification email queued", { requestId: req.id, uid: req.user.uid });
    return res.status(200).json({ message: "Verification email sent." });
  } catch (error) {
    log.error("verify failed", { requestId: req.id, uid: req.user?.uid, code: error?.code, error });
    return res
      .status(500)
      .json({ error: "Failed to generate verification link" });
  }
};

const accountSettings = async (req, res) => {
  const { displayName, email, password } = req.body ?? {};
  const uid = req.user.uid;

  const updateFields = {};
  if (displayName !== undefined) {
    const trimmed = String(displayName).trim();
    if (!trimmed) {
      return res.status(400).json({ error: "Display name can't be empty." });
    }
    updateFields.displayName = trimmed;
  }
  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    updateFields.email = trimmed;
    updateFields.emailVerified = false; // Re-trigger verification on email change
  }
  if (password !== undefined) {
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Use at least 8 characters for your password." });
    }
    updateFields.password = password;
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: "No fields provided for update" });
  }

  try {
    const updatedUser = await auth.updateUser(uid, updateFields);

    // Keep the Mongo profile in sync — `me` and every workspace/member lookup
    // read displayName/email from here, not from Firebase directly.
    const mongoPatch = {};
    if (updateFields.displayName !== undefined) mongoPatch.displayName = updateFields.displayName;
    if (updateFields.email !== undefined) {
      mongoPatch.email = updateFields.email;
      mongoPatch.isEmailVerified = false;
    }
    if (Object.keys(mongoPatch).length > 0) {
      await User.updateOne({ firebaseUid: uid }, mongoPatch);
    }

    // Best effort cache invalidation — never blocks the response.
    await cacheDel(`session:user:${uid}`);

    // Revoke all existing refresh tokens if password or email changed — the
    // client signs the user out right after and asks them to sign back in.
    if (password || email) {
      await auth.revokeRefreshTokens(uid);
    }

    // A changed email needs its own verification link.
    if (updateFields.email) {
      try {
        const firebaseLink = await auth.generateEmailVerificationLink(
          updateFields.email,
          actionCodeSettings,
        );
        const verificationLink = buildAppActionLink(firebaseLink, "verifyEmail");
        await enqueueEmail(
          {
            to: updateFields.email,
            subject: "Verify your new email",
            html: `<p>Confirm your new email address by clicking <a href="${verificationLink}">this link</a>.</p>`,
          },
          { requestId: req.id, kind: "verifyNewEmail", uid },
        );
      } catch (linkError) {
        log.error("failed to send re-verification email", { requestId: req.id, uid, error: linkError });
      }
    }

    log.info("account settings updated", {
      requestId: req.id,
      uid,
      fields: Object.keys(updateFields),
    });

    return res.status(200).json({
      message: "Account settings updated successfully.",
      user: {
        uid: updatedUser.uid,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        emailVerified: updatedUser.emailVerified,
      },
    });
  } catch (error) {
    log.error("accountSettings failed", { requestId: req.id, uid, code: error?.code, error });
    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    if (error.code === "auth/invalid-password") {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Permanently deletes the signed-in user. Blocked while they still own a
 * workspace (deleting those first avoids orphaning other members' access);
 * membership on other people's workspaces is cleaned up automatically.
 */
const deleteAccount = async (req, res) => {
  const uid = req.user.uid;

  try {
    const ownedCount = await Workspace.countDocuments({ owner: uid });
    if (ownedCount > 0) {
      return res.status(409).json({
        error: `You still own ${ownedCount} workspace${ownedCount === 1 ? "" : "s"}. Delete ${
          ownedCount === 1 ? "it" : "them"
        } first, then delete your account.`,
      });
    }

    // Leave every workspace where this account is a member.
    await Workspace.updateMany({ members: uid }, { $pull: { members: uid } });

    const dbUser = await User.findOne({ firebaseUid: uid }).select("email").lean();
    if (dbUser?.email) {
      // Pending invites addressed to this email no longer lead anywhere.
      await Invitation.deleteMany({ email: dbUser.email.toLowerCase(), status: "pending" });
    }

    await User.deleteOne({ firebaseUid: uid });
    await cacheDel(`session:user:${uid}`);
    await auth.deleteUser(uid);

    log.info("account deleted", { requestId: req.id, uid });
    return res.status(200).json({ message: "Account deleted." });
  } catch (error) {
    log.error("deleteAccount failed", { requestId: req.id, uid, code: error?.code, error });
    return res.status(500).json({ error: error.message });
  }
};

export { register, login, me, forgotPassword, verify, accountSettings, deleteAccount };
