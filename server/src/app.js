import express from "express";
import helmet from "helmet"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose";
dotenv.config()

import authRoutes from "./routes/auth.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import invitationRoutes from "./routes/invitation.routes.js";
import queueRoutes from "./routes/queue.routes.js";

const app = express()

app.use(
  cors({
    origin: "http://localhost:3000", // Next.js frontend
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Only needed if using cookies/auth credentials
  })
);

app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes)
app.use("/api/workspace", workspaceRoutes)
app.use("/api/invitations", invitationRoutes)
app.use("/api/admin/queues", queueRoutes)



mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/auth_db")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server listening on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => console.error("MongoDB Connection Failed:", err));
