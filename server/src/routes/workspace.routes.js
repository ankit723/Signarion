import Router from "express"
import authenticate from "../middlewares/auth.middleware.js"
import { addDomain, createWorkspace, deleteWorkspace, getUserWorkspaces, getWorkspaceDetails, updateWorkspace } from "../controllers/workspace.controller.js"

const workspaceRoutes = Router()

workspaceRoutes.get("/", authenticate, getUserWorkspaces) //get all workspaces
workspaceRoutes.post("/", authenticate, createWorkspace) //create workspace
workspaceRoutes.get("/:workspaceId", authenticate, getWorkspaceDetails) //get workspace details (incl. icp)
workspaceRoutes.patch("/:workspaceId", authenticate, updateWorkspace) //rename workspace
workspaceRoutes.put("/:workspaceId", authenticate, addDomain) //add / re-analyze domain
workspaceRoutes.delete("/:workspaceId", authenticate, deleteWorkspace) //delete workspace


export default workspaceRoutes
