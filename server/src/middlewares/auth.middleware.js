import redis from "../utils/redis.js";
import { auth } from "../utils/firebase.js";

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing token header" });
  }

  const token = header.split("Bearer ")[1];

  try {
    const cacheKey = `session:token:${token}`;
    const cachedUser = await redis.get(cacheKey);

    if (cachedUser) {
      req.user = JSON.parse(cachedUser);
      return next();
    }

    const decodedToken = await auth.verifyIdToken(token, true);

    const userPayload = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };

    await redis.setex(cacheKey, 900, JSON.stringify(userPayload));

    req.user = userPayload;
    return next();
  } catch (error) {
    if (error.code === "auth/id-token-revoked") {
      return res.status(401).json({ error: "Token has been revoked" });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export default authenticate;
