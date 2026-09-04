import { auth } from "../utils/firebase.js";
import redis from "../utils/redis.js";
import User from "../models/user.model.js";
import emailQueue from "../utils/emailQueue.js";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const SESSION_TTL_SECONDS = 86400;

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

    await emailQueue.add("sendEmail", {
      to: email,
      subject: "Verify your email",
      html: `<p>Welcome! Confirm your email address by clicking <a href="${verificationLink}">this link</a>.</p>`,
    });

    return res.status(201).json({
      message: "Account created. Check your inbox to verify your email.",
      user: newUser,
    });
  } catch (error) {
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

    return res.status(200).json({ message: "Authenticated successfully", user: sessionData });
  } catch (error) {
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

    return res.status(200).json({ user: userProfile });
  } catch (error) {
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

    await emailQueue.add("sendEmail", {
      to: email,
      subject: "Reset your password",
      html: `<p>We received a request to reset your password. Click <a href="${resetLink}">this link</a> to choose a new one. If you didn't ask for this, you can ignore this email.</p>`,
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    // Never reveal whether the account exists.
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

    await emailQueue.add("sendEmail", {
      to: dbUser.email,
      subject: "Verify your email",
      html: `<p>Confirm your email address by clicking <a href="${verificationLink}">this link</a>.</p>`,
    });

    return res.status(200).json({ message: "Verification email sent." });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to generate verification link" });
  }
};

const accountSettings = async (req, res) => {
  const { displayName, email, password } = req.body;
  const uid = req.user.uid;

  const updateFields = {};
  if (displayName !== undefined) updateFields.displayName = displayName;
  if (email !== undefined) {
    updateFields.email = email;
    updateFields.emailVerified = false; // Re-trigger verification on email change
  }
  if (password !== undefined) updateFields.password = password;

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: "No fields provided for update" });
  }

  try {
    const updatedUser = await auth.updateUser(uid, updateFields);

    // Invalidate Redis caches to maintain consistency across services
    await redis.del(`session:user:${uid}`);

    // Revoke all existing refresh tokens if password or email changed
    if (password || email) {
      await auth.revokeRefreshTokens(uid);
    }

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
    return res.status(500).json({ error: error.message });
  }
};

export { register, login, me, forgotPassword, verify, accountSettings };
