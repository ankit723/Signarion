/**
 * Gates the ops/admin routes (queue monitoring). With no ADMIN_EMAILS set,
 * any signed-in user can see it — this is internal tooling, not user data.
 * Set ADMIN_EMAILS (comma-separated) in .env to lock it down to specific people.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const requireAdmin = (req, res, next) => {
  if (ADMIN_EMAILS.length === 0) return next();
  const email = (req.user?.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
};

export default requireAdmin;
