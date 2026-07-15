import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ModuleService } from "./modules.service.js";
import { createModuleSchema, updateModuleSchema, assignModuleToRoleSchema, listModulesSchema } from "./modules.schemas.js";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { requirePermissions } from "../../middlewares/authorization.middleware.js";

const modulesRouter = Router();
const moduleService = new ModuleService(prisma);

modulesRouter.get("/", authMiddleware, requirePermissions("MODULES_READ"), async (req, res, next) => {
  try {
    const input = listModulesSchema.parse(req.query);
    const result = await moduleService.list(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

modulesRouter.post("/", authMiddleware, requirePermissions("MODULES_CREATE"), async (req: AuthRequest, res, next) => {
  try {
    const input = createModuleSchema.parse(req.body);
    const createdBy = req.user?.userId ?? "system";
    const module = await moduleService.create(input, createdBy);
    res.status(201).json(module);
  } catch (error) {
    next(error);
  }
});

modulesRouter.put("/:id", authMiddleware, requirePermissions("MODULES_UPDATE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = updateModuleSchema.parse(req.body);
    const updatedBy = req.user?.userId ?? "system";
    const module = await moduleService.update(id, input, updatedBy);
    res.status(200).json(module);
  } catch (error) {
    next(error);
  }
});

modulesRouter.delete("/:id", authMiddleware, requirePermissions("MODULES_DELETE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const deletedBy = req.user?.userId ?? "system";
    const module = await moduleService.delete(id, deletedBy);
    res.status(200).json(module);
  } catch (error) {
    next(error);
  }
});

modulesRouter.post("/roles/:id/modules", authMiddleware, requirePermissions("ROLES_ASSIGN_MODULE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = assignModuleToRoleSchema.parse(req.body);
    const assignedBy = req.user?.userId ?? "system";
    await moduleService.assignToRole(id, input, assignedBy);
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { modulesRouter };
