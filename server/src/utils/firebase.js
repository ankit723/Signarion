import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createLogger } from "./logger.js";

import serviceAccount from "../../serviceAccount.json" with { type: "json" };

const log = createLogger("firebase");

let app;
try {
  app =
    getApps().length === 0
      ? initializeApp({ credential: cert(serviceAccount) })
      : getApp();

  log.info("firebase-admin initialised", {
    projectId: serviceAccount?.project_id,
    clientEmail: serviceAccount?.client_email,
  });
} catch (error) {
  // Without Firebase every authenticated route is dead. Exit loudly at boot so
  // ECS shows a crash loop, instead of a "healthy" task that 401s everything.
  log.error("firebase-admin failed to initialise — exiting", { error });
  process.exit(1);
}

export const auth = getAuth(app);
