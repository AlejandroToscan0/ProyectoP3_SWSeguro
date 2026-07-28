import { randomUUID } from "node:crypto";

export type Sale = {
  id: string;
  producto: string;
  monto: number;
  creadoPor: string;
  roleId: string;
  fechaCreacion: string;
};

const sales: Sale[] = [];

export const salesStore = {
  list(): Sale[] {
    return [...sales].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
  },

  create(input: { producto: string; monto: number; creadoPor: string; roleId: string }): Sale {
    const sale: Sale = {
      id: randomUUID(),
      producto: input.producto,
      monto: input.monto,
      creadoPor: input.creadoPor,
      roleId: input.roleId,
      fechaCreacion: new Date().toISOString(),
    };
    sales.push(sale);
    return sale;
  },
};
