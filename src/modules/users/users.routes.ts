import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { UserService } from "./users.service.js";
import { createUserSchema, updateUserSchema, listUsersSchema } from "./users.schemas.js";
import { authMiddleware, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { requirePermissions } from "../../middlewares/authorization.middleware.js";

const usersRouter = Router();
const userService = new UserService(prisma);

usersRouter.get("/", authMiddleware, requirePermissions("USERS_READ"), async (req, res, next) => {
  try {
    const input = listUsersSchema.parse(req.query);
    const result = await userService.list(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", authMiddleware, requirePermissions("USERS_READ"), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const user = await userService.findById(id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", authMiddleware, requirePermissions("USERS_CREATE"), async (req: AuthRequest, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);
    const createdBy = req.user?.userId ?? "system";
    const user = await userService.create(input, createdBy);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/:id", authMiddleware, requirePermissions("USERS_UPDATE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const input = updateUserSchema.parse(req.body);
    const updatedBy = req.user?.userId ?? "system";
    const user = await userService.update(id, input, updatedBy);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", authMiddleware, requirePermissions("USERS_DELETE"), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== "string") {
      throw new Error("Invalid id");
    }
    const deletedBy = req.user?.userId ?? "system";
    const user = await userService.delete(id, deletedBy);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

export { usersRouter };
