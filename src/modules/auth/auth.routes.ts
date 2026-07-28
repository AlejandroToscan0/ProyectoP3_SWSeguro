import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../../lib/prisma.js";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { AuthService } from "./auth.service.js";
import { loginSchema, logoutSchema, refreshTokenSchema, selectRoleSchema, switchRoleSchema } from "./auth.schemas.js";

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

authRouter.post("/switch-role", authRateLimit, authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const input = switchRoleSchema.parse(req.body);
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "MISSING_TOKEN", message: "Token de autenticación requerido" });
      return;
    }
    const meta = {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };
    const result = await authService.switchRole(user.userId, user.roleId, input, {
      ip: meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/my-roles", authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "MISSING_TOKEN", message: "Token de autenticación requerido" });
      return;
    }
    const roles = await authService.listActiveRoles(user.userId);
    res.status(200).json({ roles, activeRoleId: user.roleId });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh-token", authRateLimit, async (req, res, next) => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const meta = {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };
    const result = await authService.refreshToken(input, {
      ip: meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", authRateLimit, async (req, res, next) => {
  try {
    const input = logoutSchema.parse(req.body);
    const meta = {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };
    const result = await authService.logout(input, {
      ip: meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export { authRouter };
