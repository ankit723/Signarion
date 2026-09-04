import {Router} from "express"
import { authLimiter } from "../utils/rate-limiter.js"
import authenticate from "../middlewares/auth.middleware.js"
import { accountSettings, deleteAccount, forgotPassword, login, me, register, verify } from "../controllers/auth.controller.js"

const authRoutes = Router()

authRoutes.post("/register", authLimiter, register)
authRoutes.post("/login", authLimiter, login)
authRoutes.post("/forgot-password", authLimiter, forgotPassword)

authRoutes.get("/me", authenticate, me)
authRoutes.get("/verify", authenticate, verify)
authRoutes.patch("/account-settings", authenticate, accountSettings)
authRoutes.delete("/account", authenticate, deleteAccount)

export default authRoutes