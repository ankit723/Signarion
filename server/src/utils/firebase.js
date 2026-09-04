import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import serviceAccount from "../../serviceAccount.json" with { type: "json" };

const app =
  getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount) })
    : getApp();

export const auth = getAuth(app);
