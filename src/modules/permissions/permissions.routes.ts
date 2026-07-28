import { Router } from "express";
import { Estado } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermissions } from "../../middlewares/authorization.middleware.js";

const permissionsRouter = Router();

permissionsRouter.get("/", authMiddleware, requirePermissions("ROLES_READ"), async (_req, res, next) => {
  try {
    const data = await prisma.permission.findMany({
      where: { estado: Estado.ACTIVO },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        estado: true,
      },
      orderBy: { codigo: "asc" },
    });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

export { permissionsRouter };
