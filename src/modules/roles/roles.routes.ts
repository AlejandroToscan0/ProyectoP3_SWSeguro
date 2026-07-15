import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { RoleService } from "./roles.service.js";
import { createRoleSchema, updateRoleSchema, assignUserToRoleSchema, listRolesSchema } from "./roles.schemas.js";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { requirePermissions } from "../../middlewares/authorization.middleware.js";

const rolesRouter = Router();
const roleService = new RoleService(prisma);

rolesRouter.get("/", authMiddleware, requirePermissions("ROLES_READ"), async (req, res, next) => {
  try {
    const input = listRolesSchema.parse(req.query);
    const result = await roleService.list(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

rolesRouter.post("/", authMiddleware, requirePermissions("ROLES_CREATE"), async (req: AuthRequest, res, next) => {
  try {
    const input = createRoleSchema.parse(req.body);
    const createdBy = req.user?.userId ?? "system";
    const role = await roleService.create(input, createdBy);
    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
});

rolesRouter.put("/:id", authMiddleware, requirePermissions("ROLES_UPDATE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = updateRoleSchema.parse(req.body);
    const updatedBy = req.user?.userId ?? "system";
    const role = await roleService.update(id, input, updatedBy);
    res.status(200).json(role);
  } catch (error) {
    next(error);
  }
});

rolesRouter.delete("/:id", authMiddleware, requirePermissions("ROLES_DELETE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const deletedBy = req.user?.userId ?? "system";
    const role = await roleService.delete(id, deletedBy);
    res.status(200).json(role);
  } catch (error) {
    next(error);
  }
});

rolesRouter.post("/:id/users", authMiddleware, requirePermissions("ROLES_ASSIGN_USER"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = assignUserToRoleSchema.parse(req.body);
    const assignedBy = req.user?.userId ?? "system";
    await roleService.assignUser(id, input, assignedBy);
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

rolesRouter.delete("/:id/users/:userId", authMiddleware, requirePermissions("ROLES_REMOVE_USER"), async (req: AuthRequest, res, next) => {
  try {
    const { id, userId } = req.params;
    if (typeof id !== "string" || typeof userId !== "string") {
      throw new Error("Invalid id");
    }
    const removedBy = req.user?.userId ?? "system";
    await roleService.removeUser(id, userId, removedBy);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { rolesRouter };
