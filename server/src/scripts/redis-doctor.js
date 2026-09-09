/**
 * Redis connectivity doctor.
 *
 * "Failed to refresh slots cache." is ioredis telling you it could not run
 * CLUSTER SLOTS on any startup node, without saying why. This walks the stack
 * one layer at a time — DNS, TCP, plaintext handshake, TLS handshake, AUTH,
 * cluster mode — and prints the REDIS_URL that should actually work.
 *
 * Run it from INSIDE the VPC so it sees the same network as the API:
 *
 *   aws ecs run-task \
 *     --cluster <cluster> --task-definition <api-task-def> --launch-type FARGATE \
 *     --network-configuration '<same subnets and security groups as the api service>' \
 *     --overrides '{"containerOverrides":[{"name":"web-api-container","command":["node","src/scripts/redis-doctor.js"]}]}'
 *
 * Locally it will just report that the endpoint is unreachable, which is expected.
 */
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";
import dotenv from "dotenv";

dotenv.config();

const TIMEOUT_MS = Number(process.env.DOCTOR_TIMEOUT_MS) || 5_000;
const raw = process.env.REDIS_URL;

const say = (...args) => console.log(...args);
const ok = (msg) => say(`  PASS  ${msg}`);
const bad = (msg) => say(`  FAIL  ${msg}`);
const info = (msg) => say(`        ${msg}`);

if (!raw) {
  say("REDIS_URL is not set. Nothing to test.");
  process.exit(1);
}

const withScheme = /^rediss?:\/\//i.test(raw) ? raw : `redis://${raw}`;
const url = new URL(withScheme);
const host = url.hostname;
const port = Number(url.port) || 6379;
const password = url.password || process.env.REDIS_PASSWORD || "";
const username = url.username || process.env.REDIS_USERNAME || "";

say("");
say("Redis doctor");
say("============");
say(`  endpoint        ${host}:${port}`);
say(`  scheme in URL   ${/^rediss?:\/\//i.test(raw) ? url.protocol.replace(":", "") : "(none — assuming redis://)"}`);
say(`  credentials     ${password ? "password present" : "no password"}${username ? ` (username ${username})` : ""}`);
say(`  looks like      ${host.startsWith("clustercfg.") ? "ElastiCache CLUSTER MODE ENABLED config endpoint" : "a standalone / cluster-mode-disabled endpoint"}`);
say("");

/* ---------------------------------------------------------------- */
/* 1. DNS                                                            */
/* ---------------------------------------------------------------- */
say("1. DNS resolution");
let addresses = [];
try {
  addresses = await dns.lookup(host, { all: true });
  ok(`resolves to ${addresses.map((a) => a.address).join(", ")}`);
} catch (error) {
  bad(`cannot resolve ${host} — ${error.message}`);
  info("The task cannot see this hostname. Check you are in the right VPC and that");
  info("DNS resolution/hostnames are enabled on it.");
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* 2. Raw TCP                                                        */
/* ---------------------------------------------------------------- */
say("");
say("2. TCP reachability (security groups / routing)");
const tcpResult = await new Promise((resolve) => {
  const socket = net.connect({ host, port });
  const done = (result) => {
    socket.removeAllListeners();
    socket.destroy();
    resolve(result);
  };
  socket.setTimeout(TIMEOUT_MS);
  socket.on("connect", () => done({ ok: true }));
  socket.on("timeout", () => done({ ok: false, reason: "timed out" }));
  socket.on("error", (error) => done({ ok: false, reason: error.message, code: error.code }));
});

if (tcpResult.ok) {
  ok(`TCP connect to ${host}:${port} succeeded`);
} else {
  bad(`TCP connect failed — ${tcpResult.reason}`);
  if (tcpResult.reason === "timed out") {
    info("A timeout (rather than a refusal) almost always means a security group.");
    info("The ElastiCache security group needs an inbound rule on port " + port);
    info("allowing the ECS task's security group as the source.");
  }
  info("Nothing below this layer can work until TCP connects. Stopping here.");
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* 3 & 4. Handshake, plaintext then TLS                              */
/* ---------------------------------------------------------------- */

/**
 * Speaks just enough RESP to send commands and read replies.
 *
 * CLUSTER INFO answers with a multi-line bulk string, so counting CRLFs would
 * stop reading half way through it. Instead we resolve as soon as the reply we
 * actually care about shows up, and otherwise once the server goes quiet.
 */
const speak = (socket, commands) =>
  new Promise((resolve) => {
    let buffer = "";
    let idle;

    const hardTimer = setTimeout(
      () => finish({ ok: false, reason: "no reply before timeout", raw: buffer }),
      TIMEOUT_MS,
    );

    const finish = (result) => {
      clearTimeout(hardTimer);
      clearTimeout(idle);
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    const settled = () =>
      /cluster_enabled:/.test(buffer) ||
      /cluster support disabled/i.test(buffer) ||
      /NOAUTH|WRONGPASS|invalid password|without any password/i.test(buffer);

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (settled()) return finish({ ok: true, raw: buffer });
      // Otherwise give the server a moment in case more is coming.
      clearTimeout(idle);
      idle = setTimeout(() => finish({ ok: true, raw: buffer }), 750);
    });
    socket.on("error", (error) => finish({ ok: false, reason: error.message, code: error.code, raw: buffer }));

    for (const cmd of commands) {
      const parts = cmd.split(" ");
      socket.write(
        `*${parts.length}\r\n${parts.map((p) => `$${Buffer.byteLength(p)}\r\n${p}\r\n`).join("")}`,
      );
    }
  });

const authCommands = () => {
  if (!password) return [];
  return [username ? `AUTH ${username} ${password}` : `AUTH ${password}`];
};

const tryHandshake = async (useTls) => {
  const socket = useTls
    ? tls.connect({
        host,
        port,
        // RFC 6066 forbids an IP as SNI, and Node warns about it.
        ...(net.isIP(host) ? {} : { servername: host }),
        rejectUnauthorized: false,
      })
    : net.connect({ host, port });

  const connected = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, reason: "timed out" }), TIMEOUT_MS);
    socket.once(useTls ? "secureConnect" : "connect", () => {
      clearTimeout(timer);
      resolve({ ok: true });
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: error.message, code: error.code });
    });
  });

  if (!connected.ok) {
    socket.destroy();
    return connected;
  }

  return speak(socket, [...authCommands(), "PING", "CLUSTER INFO"]);
};

const describe = (result) => {
  const text = result.raw ?? "";
  const authFailed = /NOAUTH|WRONGPASS|invalid password|without any password/i.test(text);
  const clusterEnabled = /cluster_enabled:1/.test(text);
  const clusterDisabled = /cluster_enabled:0/.test(text);
  const pong = /\+PONG/.test(text);
  const clusterUnsupported = /cluster support disabled/i.test(text);
  return {
    authFailed,
    clusterEnabled,
    // An outright "cluster support disabled" error means the same thing as cluster_enabled:0.
    clusterDisabled: clusterDisabled || clusterUnsupported,
    pong,
    clusterUnsupported,
    text,
  };
};

say("");
say("3. Plaintext Redis handshake");
const plain = await tryHandshake(false);
const plainInfo = plain.ok ? describe(plain) : null;
if (plain.ok && plainInfo.pong) ok("PING -> PONG over plaintext");
else if (plain.ok && plainInfo.authFailed) bad("connected, but AUTH was rejected");
else if (plain.ok) bad(`connected, but no PONG. Raw reply: ${JSON.stringify(plainInfo.text.slice(0, 120))}`);
else bad(`plaintext handshake failed — ${plain.reason}`);

say("");
say("4. TLS Redis handshake");
const secure = await tryHandshake(true);
const secureInfo = secure.ok ? describe(secure) : null;
if (secure.ok && secureInfo.pong) ok("PING -> PONG over TLS");
else if (secure.ok && secureInfo.authFailed) bad("TLS connected, but AUTH was rejected");
else if (secure.ok) bad(`TLS connected, but no PONG. Raw reply: ${JSON.stringify(secureInfo.text.slice(0, 120))}`);
else bad(`TLS handshake failed — ${secure.reason}`);

/* ---------------------------------------------------------------- */
/* 5. Verdict                                                        */
/* ---------------------------------------------------------------- */
const working = secureInfo?.pong ? { tls: true, info: secureInfo } : plainInfo?.pong ? { tls: false, info: plainInfo } : null;

say("");
say("Verdict");
say("=======");

if (!working) {
  if (plainInfo?.authFailed || secureInfo?.authFailed) {
    say("  Redis is reachable but rejected authentication.");
    say("  ElastiCache has an AUTH token / RBAC user set. Put it in REDIS_URL:");
    say("    REDIS_URL=rediss://:<auth-token>@" + host + ":" + port);
    say("  (or redis:// if encryption in transit is off)");
  } else {
    say("  TCP connects but neither plaintext nor TLS produced a PONG.");
    say("  That usually means encryption in transit is on and the TLS handshake");
    say("  is being rejected, or an AUTH token is required. Check the ElastiCache");
    say("  console for 'Encryption in transit' and 'Redis AUTH'.");
  }
  process.exit(1);
}

const scheme = working.tls ? "rediss" : "redis";
const clusterMode = working.info.clusterEnabled;

say(`  Reachable over ${working.tls ? "TLS" : "plaintext"}.`);
say(`  cluster_enabled = ${clusterMode ? "1 (cluster mode ENABLED)" : working.info.clusterDisabled ? "0 (cluster mode disabled)" : "unknown"}`);
say("");
say("  Set this in the task definition for BOTH the api and worker services:");
say("");
say(`    REDIS_URL=${scheme}://${password ? `:<auth-token>@` : ""}${host}:${port}`);
if (working.tls && scheme === "rediss") say("    (rediss:// turns TLS on; REDIS_TLS=true does the same for a redis:// URL)");
say(`    REDIS_CLUSTER_MODE=${clusterMode ? "auto" : "false"}`);
if (clusterMode) {
  say("");
  say("  Cluster mode is on, so BullMQ needs the hash-tagged prefix {bull},");
  say("  which the code already selects automatically. Note that this is a");
  say("  DIFFERENT key namespace from the old 'bull' prefix — drain the queues");
  say("  before switching, or pin QUEUE_PREFIX=bull.");
  say("");
  say("  If you would rather avoid Redis Cluster entirely (simpler for BullMQ),");
  say("  create a cluster-mode-disabled ElastiCache instance and point REDIS_URL");
  say("  at its primary endpoint instead.");
}
say("");
process.exit(0);
