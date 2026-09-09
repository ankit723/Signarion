import { cacheGet, cacheSetEx } from "../utils/redis.js";
import { auth } from "../utils/firebase.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("auth.middleware");

const SESSION_CACHE_TTL_SECONDS = 900;

/**
 * Verifies the caller's Firebase ID token.
 *
 * Redis is a *cache* here, nothing more. It used to be awaited directly, which
 * meant an unreachable Redis hung the request forever (ALB 504) on every
 * authenticated route — including routes that have nothing to do with queues.
 * `cacheGet` / `cacheSetEx` can neither throw nor hang, so a Redis outage now
 * just costs us a Firebase round trip.
 */
const authenticate = async (req, res, next) => {
  const startedAt = Date.now();
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    log.warn("rejected: missing or malformed Authorization header", {
      requestId: req.id,
      path: req.originalUrl,
      hasHeader: Boolean(header),
    });
    return res.status(401).json({ error: "Unauthorized: Missing token header" });
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    log.warn("rejected: empty bearer token", { requestId: req.id, path: req.originalUrl });
    return res.status(401).json({ error: "Unauthorized: Missing token header" });
  }

  const cacheKey = `session:token:${token}`;

  // 1. Cache lookup — best effort, never fatal.
  try {
    const cachedUser = await cacheGet(cacheKey);
    if (cachedUser) {
      req.user = JSON.parse(cachedUser);
      log.debug("authenticated from cache", {
        requestId: req.id,
        uid: req.user?.uid,
        durationMs: Date.now() - startedAt,
      });
      return next();
    }
  } catch (error) {
    // Only reachable if the cached JSON is corrupt. Fall through to Firebase.
    log.warn("cached session was unreadable — verifying with Firebase instead", {
      requestId: req.id,
      error: error?.message,
    });
  }

  // 2. Verify with Firebase.
  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token, true);
  } catch (error) {
    log.warn("token verification failed", {
      requestId: req.id,
      path: req.originalUrl,
      code: error?.code,
      error: error?.message,
      durationMs: Date.now() - startedAt,
    });

    if (error?.code === "auth/id-token-revoked") {
      return res.status(401).json({ error: "Token has been revoked" });
    }
    if (error?.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token has expired" });
    }
    // A network/credential problem talking to Firebase is *our* fault, not the
    // caller's — surfacing it as 401 sent people into a pointless sign-in loop.
    if (error?.code === "auth/internal-error" || error?.errorInfo?.code === "auth/internal-error") {
      log.error("Firebase Admin could not be reached", { requestId: req.id, error });
      return res.status(503).json({ error: "Authentication service unavailable" });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userPayload = {
    uid: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified,
  };

  // 3. Populate the cache — again best effort.
  try {
    await cacheSetEx(cacheKey, SESSION_CACHE_TTL_SECONDS, JSON.stringify(userPayload));
  } catch (error) {
    log.warn("failed to cache session", { requestId: req.id, error: error?.message });
  }

  req.user = userPayload;
  log.debug("authenticated via Firebase", {
    requestId: req.id,
    uid: userPayload.uid,
    durationMs: Date.now() - startedAt,
  });
  return next();
};

export default authenticate;
