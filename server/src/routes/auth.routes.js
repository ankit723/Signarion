import {Router} from "express"
import authenticate from "../middlewares/auth.middleware.js"
import { accountSettings, deleteAccount, forgotPassword, login, me, register, verify } from "../controllers/auth.controller.js"

const authRoutes = Router()

authRoutes.post("/register", register)
authRoutes.post("/login", login)
authRoutes.post("/forgot-password", forgotPassword)

authRoutes.get("/me", authenticate, me)
authRoutes.get("/verify", authenticate, verify)
authRoutes.patch("/account-settings", authenticate, accountSettings)
authRoutes.delete("/account", authenticate, deleteAccount)

export default authRoutes