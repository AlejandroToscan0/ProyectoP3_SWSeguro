import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { HttpError } from "./common/http-error.js";
import { salesRouter } from "./routes/sales.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "50kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "ventas",
      trustModel: "zero-trust-via-master",
    });
  });

  app.use("/api/ventas", salesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "NOT_FOUND", message: "Recurso no encontrado" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Datos de entrada inválidos",
        details: err.flatten().fieldErrors,
      });
      return;
    }

    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
      });
      return;
    }

    console.error(err);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del microservicio de Ventas",
    });
  });

  return app;
}
