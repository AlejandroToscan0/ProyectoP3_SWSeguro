import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { internalsRouter } from "./modules/internals/internals.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { rolesRouter } from "./modules/roles/roles.routes.js";
import { modulesRouter } from "./modules/modules/modules.routes.js";
import { menusRouter } from "./modules/menus/menus.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/internals", internalsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/roles", rolesRouter);
  app.use("/api/modules", modulesRouter);
  app.use("/api/menus", menusRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
