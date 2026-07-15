import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { MenuService } from "./menus.service.js";
import { createMenuSchema, updateMenuSchema, assignMenuToRoleSchema, listMenusSchema } from "./menus.schemas.js";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { requirePermissions } from "../../middlewares/authorization.middleware.js";

const menusRouter = Router();
const menuService = new MenuService(prisma);

menusRouter.get("/tree", authMiddleware, requirePermissions("MENUS_READ"), async (req: AuthRequest, res, next) => {
  try {
    const roleId = req.user?.roleId;
    if (!roleId) {
      throw new Error("Missing roleId");
    }
    const tree = await menuService.getTreeForRole(roleId);
    res.status(200).json(tree);
  } catch (error) {
    next(error);
  }
});

menusRouter.get("/", authMiddleware, requirePermissions("MENUS_READ"), async (req, res, next) => {
  try {
    const input = listMenusSchema.parse(req.query);
    const result = await menuService.list(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

menusRouter.post("/", authMiddleware, requirePermissions("MENUS_CREATE"), async (req: AuthRequest, res, next) => {
  try {
    const input = createMenuSchema.parse(req.body);
    const createdBy = req.user?.userId ?? "system";
    const menu = await menuService.create(input, createdBy);
    res.status(201).json(menu);
  } catch (error) {
    next(error);
  }
});

menusRouter.put("/:id", authMiddleware, requirePermissions("MENUS_UPDATE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = updateMenuSchema.parse(req.body);
    const updatedBy = req.user?.userId ?? "system";
    const menu = await menuService.update(id, input, updatedBy);
    res.status(200).json(menu);
  } catch (error) {
    next(error);
  }
});

menusRouter.delete("/:id", authMiddleware, requirePermissions("MENUS_DELETE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const deletedBy = req.user?.userId ?? "system";
    const menu = await menuService.delete(id, deletedBy);
    res.status(200).json(menu);
  } catch (error) {
    next(error);
  }
});

menusRouter.post("/roles/:id/menus", authMiddleware, requirePermissions("ROLES_ASSIGN_MENU"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = assignMenuToRoleSchema.parse(req.body);
    const assignedBy = req.user?.userId ?? "system";
    await menuService.assignToRole(id, input, assignedBy);
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { menusRouter };
