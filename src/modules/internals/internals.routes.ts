import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { HttpError } from "../../common/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { AuthService } from "../auth/auth.service.js";
import { validateTokenSchema } from "../auth/auth.schemas.js";

const internalsRouter = Router();
const authService = new AuthService(prisma);

const internalsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Demasiadas solicitudes internas",
  },
});

internalsRouter.post("/validate-token", internalsRateLimit, async (req, res, next) => {
  try {
    const apiKey = req.get("x-internal-api-key");
    if (!apiKey || apiKey !== env.INTERNAL_API_KEY) {
      throw new HttpError(401, "INVALID_INTERNAL_KEY", "Credenciales internas invalidas");
    }

    const input = validateTokenSchema.parse(req.body);
    const result = await authService.validateToken(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export { internalsRouter };
