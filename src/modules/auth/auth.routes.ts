import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../../lib/prisma.js";
import { AuthService } from "./auth.service.js";
import { loginSchema, selectRoleSchema } from "./auth.schemas.js";

const authRouter = Router();
const authService = new AuthService(prisma);

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Demasiados intentos, intente nuevamente en un minuto",
  },
});

authRouter.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const meta = {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };
    const result = await authService.login(input, {
      ip: meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/select-role", authRateLimit, async (req, res, next) => {
  try {
    const input = selectRoleSchema.parse(req.body);
    const meta = {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };
    const result = await authService.selectRole(input, {
      ip: meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export { authRouter };
