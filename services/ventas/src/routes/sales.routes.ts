import { Router } from "express";
import { z } from "zod";
import { salesStore } from "../data/salesStore.js";
import { requirePermissions, type AuthenticatedRequest } from "../middleware/zeroTrust.js";
import { HttpError } from "../common/http-error.js";

const createSaleSchema = z.object({
  producto: z.string().trim().min(1).max(120),
  monto: z.number().positive().max(1_000_000),
});

export const salesRouter = Router();

salesRouter.get("/", requirePermissions("VENTAS_READ"), (req: AuthenticatedRequest, res) => {
  res.status(200).json({
    data: salesStore.list(),
    context: {
      userId: req.auth?.userId,
      roleId: req.auth?.roleId,
      roleName: req.auth?.roleName,
    },
  });
});

salesRouter.post("/", requirePermissions("VENTAS_CREATE"), (req: AuthenticatedRequest, res, next) => {
  try {
    const input = createSaleSchema.parse(req.body);
    if (!req.auth) {
      throw new HttpError(401, "UNAUTHORIZED", "Contexto de autenticación ausente");
    }

    const sale = salesStore.create({
      producto: input.producto,
      monto: input.monto,
      creadoPor: req.auth.userId,
      roleId: req.auth.roleId,
    });

    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
});
