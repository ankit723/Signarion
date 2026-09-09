import Redis, { Cluster } from "ioredis";
import dotenv from "dotenv";
import { createLogger } from "./logger.js";

dotenv.config();

const log = createLogger("redis");

const redisUrl = process.env.REDIS_URL;

/* ------------------------------------------------------------------ *
 * Endpoint parsing
 *
 * REDIS_URL may be a full URL (`redis://host:6379`, `rediss://…`) or a bare
 * `host:port`, which is how the ElastiCache console presents it. ioredis
 * tolerates both, but we need the host ourselves to detect cluster mode.
 * ------------------------------------------------------------------ */
const parseEndpoint = (value) => {
  if (!value) return null;
  const withScheme = /^rediss?:\/\//i.test(value) ? value : `redis://${value}`;
  try {
    const url = new URL(withScheme);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      tls: url.protocol === "rediss:",
      hadScheme: /^rediss?:\/\//i.test(value),
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch (error) {
    log.error("REDIS_URL could not be parsed", { error: error?.message });
    return null;
  }
};

const endpoint = parseEndpoint(redisUrl);

/**
 * ElastiCache "cluster mode enabled" exposes a configuration endpoint whose
 * hostname starts with `clustercfg.`. A standalone ioredis client pointed at
 * one gets MOVED redirections it won't follow, and BullMQ's multi-key Lua
 * scripts fail with CROSSSLOT — so the client type has to match the server.
 *
 * REDIS_CLUSTER_MODE: "auto" (default, detect from the hostname) | "true" | "false".
 */
const clusterModeSetting = (process.env.REDIS_CLUSTER_MODE || "auto").toLowerCase();
const looksLikeClusterEndpoint = Boolean(endpoint?.host?.startsWith("clustercfg."));
export const IS_CLUSTER =
  clusterModeSetting === "true" ||
  (clusterModeSetting === "auto" && looksLikeClusterEndpoint);

/**
 * BullMQ spreads a queue's keys across many Redis keys. On a cluster they must
 * hash to one slot, which means the prefix needs a hash tag: `{bull}`.
 *
 * NOTE: this changes the key namespace. Jobs written under the old `bull:`
 * prefix are not visible under `{bull}:` — drain the queues before switching,
 * or set QUEUE_PREFIX explicitly to keep the old one.
 */
export const QUEUE_PREFIX = process.env.QUEUE_PREFIX || (IS_CLUSTER ? "{bull}" : "bull");

if (endpoint) {
  log.info("redis endpoint configured", {
    host: endpoint.host,
    port: endpoint.port,
    tls: endpoint.tls || process.env.REDIS_TLS === "true",
    cluster: IS_CLUSTER,
    queuePrefix: QUEUE_PREFIX,
  });

  if (looksLikeClusterEndpoint && clusterModeSetting === "false") {
    log.error(
      "REDIS_URL is an ElastiCache cluster-mode configuration endpoint but REDIS_CLUSTER_MODE=false. " +
        "Standalone clients get MOVED redirections and BullMQ fails with CROSSSLOT. " +
        "Either set REDIS_CLUSTER_MODE=auto or point REDIS_URL at a cluster-mode-disabled primary endpoint.",
      { host: endpoint.host },
    );
  }

  if (!endpoint.hadScheme) {
    log.warn(
      "REDIS_URL has no scheme. Prefix it with redis:// (or rediss:// if encryption in transit is on) to be explicit.",
      { value: `${endpoint.host}:${endpoint.port}` },
    );
  }
}

/**
 * Why there are two kinds of connection here
 * ------------------------------------------
 * The API and BullMQ want opposite behaviour from ioredis:
 *
 *  - The API uses Redis as a *cache*. If Redis is unreachable, a request must
 *    fail (or skip the cache) within a second or two. Otherwise the request
 *    hangs and the ALB eventually answers 504 — which is exactly the bug this
 *    file used to cause: `maxRetriesPerRequest: null` + the default
 *    `enableOfflineQueue: true` buffers commands *forever* when Redis is down.
 *
 *  - BullMQ requires `maxRetriesPerRequest: null` (it blocks on BRPOPLPUSH and
 *    friends, which must never be aborted) and needs the offline queue.
 *
 * So: `redis` (default export) is the fail-fast cache client, and
 * `createQueueConnection()` mints connections shaped the way BullMQ needs.
 */

const baseOptions = () => ({
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 10_000,
  // ElastiCache with encryption in transit needs TLS. `rediss://` turns it on
  // automatically; REDIS_TLS=true is the escape hatch for a plain `redis://`
  // URL that still terminates TLS.
  ...(endpoint?.tls || process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
});

/**
 * Builds a standalone client or a Cluster client depending on the endpoint,
 * so callers never have to care which one they got — the command API is the
 * same for everything this codebase does.
 */
const buildClient = (options) => {
  if (!IS_CLUSTER) return new Redis(redisUrl, options);

  const { tls, ...redisOptions } = options;
  return new Cluster([{ host: endpoint.host, port: endpoint.port }], {
    redisOptions: {
      ...redisOptions,
      ...(endpoint.username ? { username: endpoint.username } : {}),
      ...(endpoint.password ? { password: endpoint.password } : {}),
      ...(tls ? { tls } : {}),
    },
    // ElastiCache advertises private IPs; resolving through the configuration
    // endpoint's DNS keeps TLS certificate validation working.
    dnsLookup: (address, callback) => callback(null, address),
    ...(tls ? { slotsRefreshTimeout: 5_000 } : {}),
    clusterRetryStrategy: options.retryStrategy,
  });
};

/**
 * ioredis retries several times a second, so an outage would otherwise emit
 * thousands of identical CloudWatch events per minute. Errors are logged on the
 * first occurrence and then at most once every ERROR_LOG_INTERVAL_MS, carrying a
 * count of what was suppressed in between.
 */
const ERROR_LOG_INTERVAL_MS = Number(process.env.REDIS_ERROR_LOG_INTERVAL_MS) || 30_000;

const attachLogging = (client, label) => {
  let lastErrorLoggedAt = 0;
  let suppressedErrors = 0;
  let wasReady = false;

  client.on("connect", () => log.debug("connection opened", { client: label }));

  client.on("ready", () => {
    wasReady = true;
    lastErrorLoggedAt = 0;
    suppressedErrors = 0;
    log.info("connection ready", { client: label });
  });

  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) {
      suppressedErrors += 1;
      return;
    }
    log.error("connection error", {
      client: label,
      code: err?.code,
      error: err?.message,
      // The generic cluster message says nothing; pass the Error itself so the
      // logger can unwrap `lastNodeError` and show what actually failed.
      ...(err?.lastNodeError ? { underlying: err } : {}),
      ...(suppressedErrors ? { suppressedSinceLastLog: suppressedErrors } : {}),
    });
    lastErrorLoggedAt = now;
    suppressedErrors = 0;
  });

  client.on("close", () => {
    // Only worth a warning the first time we lose a connection that was working.
    if (wasReady) {
      wasReady = false;
      log.warn("connection lost", { client: label });
    } else {
      log.debug("connection closed", { client: label });
    }
  });

  client.on("reconnecting", (delay) => log.debug("reconnecting", { client: label, delayMs: delay }));
  client.on("end", () => log.warn("connection ended (no more reconnects)", { client: label }));
  return client;
};

/**
 * Cache client. Fails fast so a Redis outage degrades the API instead of
 * hanging it.
 */
const createCacheConnection = () => {
  if (!redisUrl) return null;

  return attachLogging(
    buildClient({
      ...baseOptions(),
      // Bounded: a command gives up after a few attempts instead of queueing forever.
      maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST) || 2,
      // Hard ceiling on any single command. This is the single most important
      // setting for avoiding 504s.
      commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 3_000,
      // Don't buffer commands while disconnected — reject them immediately.
      enableOfflineQueue: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5_000);
        // First attempt only, then every 50th — the "connection error" handler
        // already reports the ongoing outage on its own schedule.
        if (times === 1 || times % 50 === 0) {
          log.warn("cache retry scheduled", { attempt: times, delayMs: delay });
        }
        return delay;
      },
    }),
    "cache",
  );
};

/**
 * BullMQ connection. Must keep `maxRetriesPerRequest: null` and the offline
 * queue — do not "fix" those the way the cache client is configured.
 *
 * Each Queue/Worker should get its own connection: BullMQ workers hold a
 * blocking connection, and sharing one instance across workers makes their
 * commands queue behind each other.
 */
export const createQueueConnection = (label = "queue") => {
  if (!redisUrl) {
    log.error("REDIS_URL is not set — queue connection unavailable", { client: label });
    return null;
  }

  return attachLogging(
    buildClient({
      ...baseOptions(),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5_000);
        if (times === 1 || times % 50 === 0) {
          log.warn("queue retry scheduled", { client: label, attempt: times, delayMs: delay });
        }
        return delay;
      },
    }),
    label,
  );
};

const redis = createCacheConnection();

if (!redis) {
  log.error(
    "REDIS_URL is not set. Session caching is disabled and every queue-backed route will fail. " +
      "Set REDIS_URL in the ECS task definition for BOTH the api and worker services.",
  );
}

/**
 * True when the cache client exists and is actually usable right now.
 * A Cluster client exposes the same `status` field, so one check covers both.
 */
export const isCacheReady = () => Boolean(redis) && redis.status === "ready";

/** True when the client is a Cluster client (BullMQ needs a hash-tagged prefix). */
export const isClusterClient = () => Boolean(redis?.isCluster);

/**
 * Best-effort cache helpers. They never throw and never hang: a Redis problem
 * turns into a logged miss, and the caller falls back to the source of truth.
 */
export const cacheGet = async (key) => {
  if (!isCacheReady()) {
    log.debug("cache get skipped (not ready)", { key, status: redis?.status ?? "absent" });
    return null;
  }
  try {
    const startedAt = Date.now();
    const value = await redis.get(key);
    log.debug("cache get", { key, hit: value !== null, durationMs: Date.now() - startedAt });
    return value;
  } catch (error) {
    log.warn("cache get failed — falling back to source of truth", { key, error: error?.message });
    return null;
  }
};

export const cacheSetEx = async (key, ttlSeconds, value) => {
  if (!isCacheReady()) return false;
  try {
    await redis.setex(key, ttlSeconds, value);
    log.debug("cache set", { key, ttlSeconds });
    return true;
  } catch (error) {
    log.warn("cache set failed", { key, error: error?.message });
    return false;
  }
};

export const cacheDel = async (key) => {
  if (!isCacheReady()) return false;
  try {
    await redis.del(key);
    log.debug("cache del", { key });
    return true;
  } catch (error) {
    log.warn("cache del failed", { key, error: error?.message });
    return false;
  }
};

/**
 * Used by the readiness probe. Returns latency in ms, or null if unreachable.
 *
 * The race matters: a Cluster client that has never reached its configuration
 * endpoint keeps `ping()` pending while it tries to fetch the slot map, and
 * `commandTimeout` does not cover that wait. A readiness probe that hangs is
 * the same failure we are fixing everywhere else.
 */
const PING_TIMEOUT_MS = Number(process.env.REDIS_PING_TIMEOUT_MS) || 2_000;

export const pingCache = async () => {
  if (!redis) return null;

  const startedAt = Date.now();
  let timer;
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(Symbol.for("timeout")), PING_TIMEOUT_MS);
      }),
    ]);

    if (result === Symbol.for("timeout")) {
      log.warn("ping timed out", { timeoutMs: PING_TIMEOUT_MS, status: redis.status });
      return null;
    }
    return Date.now() - startedAt;
  } catch (error) {
    log.warn("ping failed", { error: error?.message, status: redis.status });
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const closeRedis = async () => {
  if (!redis) return;
  try {
    await redis.quit();
    log.info("cache connection closed cleanly");
  } catch (error) {
    log.warn("error while closing cache connection", { error: error?.message });
  }
};

export default redis;
