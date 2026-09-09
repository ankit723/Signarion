/**
 * Tiny structured logger. Everything goes to stdout/stderr as a single line so
 * CloudWatch Logs keeps one event per log and you can filter with
 * `{ $.level = "error" }` / `{ $.scope = "redis" }` in Logs Insights.
 *
 * Never throws: logging must not be able to take the process down.
 */
const SERVICE = process.env.SERVICE_NAME || "api";

const write = (stream, level, scope, message, meta) => {
  try {
    const line = {
      ts: new Date().toISOString(),
      level,
      service: SERVICE,
      scope,
      message,
      ...(meta && Object.keys(meta).length ? { meta: safeMeta(meta) } : {}),
    };
    stream(JSON.stringify(line));
  } catch {
    // Last resort — never let the logger itself break a request.
    try {
      stream(`[${level}] [${scope}] ${message}`);
    } catch {
      /* give up silently */
    }
  }
};

/** Unwraps an Error, following the chain that hides the real cause. */
const serializeError = (value, depth = 0) => {
  const out = {
    name: value.name,
    message: value.message,
    code: value.code,
    stack: value.stack,
  };

  if (depth >= 3) return out;

  // ioredis buries the actual failure: a Cluster client reports the generic
  // "Failed to refresh slots cache." and puts the real reason (ECONNREFUSED,
  // NOAUTH, wrong TLS, cluster support disabled) on `lastNodeError`.
  const cause = value.lastNodeError ?? value.cause ?? value.previousErrors?.[0];
  if (cause instanceof Error) {
    out.cause = serializeError(cause, depth + 1);
  }

  return out;
};

/** Strips things that can't be serialized and unwraps Errors. */
const safeMeta = (meta) => {
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      out[key] = serializeError(value);
    } else if (typeof value === "function" || typeof value === "symbol") {
      out[key] = String(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

/**
 * Wraps a log function so a repeating fault (a Redis outage retrying several
 * times a second) costs one log line per interval instead of thousands. The
 * suppressed count rides along on the next line that does get through.
 */
export const throttle = (fn, intervalMs = 30_000) => {
  let lastLoggedAt = 0;
  let suppressed = 0;

  return (message, meta) => {
    const now = Date.now();
    if (now - lastLoggedAt < intervalMs) {
      suppressed += 1;
      return;
    }
    fn(message, { ...meta, ...(suppressed ? { suppressedSinceLastLog: suppressed } : {}) });
    lastLoggedAt = now;
    suppressed = 0;
  };
};

export const createLogger = (scope) => ({
  debug: (message, meta) => {
    if (process.env.LOG_LEVEL === "debug") write(console.log, "debug", scope, message, meta);
  },
  info: (message, meta) => write(console.log, "info", scope, message, meta),
  warn: (message, meta) => write(console.warn, "warn", scope, message, meta),
  error: (message, meta) => write(console.error, "error", scope, message, meta),
});

export default createLogger;
