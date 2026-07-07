import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../common/http-error.js";
import { logger } from "../config/logger.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Recurso no encontrado",
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Datos de entrada invalidos",
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

  logger.error({ err }, "Error no controlado");
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "Error interno del servidor",
  });
}
