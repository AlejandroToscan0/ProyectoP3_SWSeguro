import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

type Transformers = typeof import("@huggingface/transformers");

let transformers: Transformers | null = null;
let pipe: ((text: string) => Promise<{ label: string; score: number }[]>) | null = null;
let modelLoaded = false;

export function isModelLoaded(): boolean {
  return modelLoaded;
}

export async function loadModel(): Promise<void> {
  if (modelLoaded) return;

  const modelName = env.ML_MODEL_NAME;

  try {
    transformers = await import("@huggingface/transformers");
    pipe = await transformers.pipeline("text-classification", modelName);
    modelLoaded = true;
    logger.info(`Modelo ML cargado: ${modelName}`);
  } catch (err) {
    logger.error({ err }, "Error al cargar el modelo ML");
    throw err;
  }
}

export async function predict(code: string): Promise<boolean> {
  if (!modelLoaded || !pipe) {
    throw new Error("Modelo no cargado. Llama a loadModel() primero.");
  }

  const results = await pipe(code);

  const top = results[0];
  if (!top) return false;

  return top.label === "Vulnerable" && top.score > 0.5;
}
