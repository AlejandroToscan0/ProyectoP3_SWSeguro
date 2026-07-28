import { Router } from "express";
import { Estado } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { requirePermissions } from "../../middlewares/authorization.middleware.js";
import { HttpError } from "../../common/http-error.js";

const permissionsRouter = Router();

const createPermissionSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Z][A-Z0-9_]*$/, "El código debe ser MAYÚSCULAS_CON_GUION_BAJO"),
  descripcion: z.string().trim().max(500).optional(),
});

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

permissionsRouter.post(
  "/",
  authMiddleware,
  requirePermissions("ROLES_ASSIGN_PERMISSION"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = createPermissionSchema.parse(req.body);
      const actor = req.user?.userId ?? "system";

      const existing = await prisma.permission.findUnique({
        where: { codigo: input.codigo },
      });

      if (existing) {
        if (existing.estado === Estado.ACTIVO) {
          throw new HttpError(409, "PERMISSION_ALREADY_EXISTS", "El permiso ya existe");
        }

        const reactivated = await prisma.permission.update({
          where: { id: existing.id },
          data: {
            estado: Estado.ACTIVO,
            descripcion: input.descripcion ?? existing.descripcion,
            actualizadoPor: actor,
          },
          select: {
            id: true,
            codigo: true,
            descripcion: true,
            estado: true,
          },
        });
        res.status(200).json(reactivated);
        return;
      }

      const created = await prisma.permission.create({
        data: {
          codigo: input.codigo,
          descripcion: input.descripcion ?? `Permiso ${input.codigo}`,
          estado: Estado.ACTIVO,
          creadoPor: actor,
          actualizadoPor: actor,
        },
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          estado: true,
        },
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  },
);

export { permissionsRouter };
