import { Estado, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../common/http-error.js";
import type { CreateModuleInput, UpdateModuleInput, AssignModuleToRoleInput, ListModulesInput } from "./modules.schemas.js";

const moduleSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  baseUrl: true,
  healthPath: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  creadoPor: true,
  actualizadoPor: true,
} as const;

type SafeModule = {
  id: string;
  nombre: string;
  descripcion: string | null;
  baseUrl: string | null;
  healthPath: string | null;
  estado: Estado;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  creadoPor: string | null;
  actualizadoPor: string | null;
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export class ModuleService {
  constructor(private readonly db: PrismaClient) {}

  async list(input: ListModulesInput): Promise<PaginatedResponse<SafeModule>> {
    const { page, limit, search, estado } = input;
    const skip = (page - 1) * limit;

    const where: {
      estado?: Estado;
      OR?: Array<{ nombre: { contains: string; mode: "insensitive" } } | { descripcion: { contains: string; mode: "insensitive" } }>;
    } = {
      estado,
    };

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { descripcion: { contains: search, mode: "insensitive" } },
      ];
    }

    const [modules, total] = await Promise.all([
      this.db.module.findMany({
        where,
        skip,
        take: limit,
        select: moduleSelect,
        orderBy: { fechaCreacion: "desc" },
      }),
      this.db.module.count({ where }),
    ]);

    return {
      data: modules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SafeModule> {
    const module = await this.db.module.findUnique({
      where: { id },
      select: moduleSelect,
    });

    if (!module) {
      throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
    }

    return module;
  }

  async create(input: CreateModuleInput, createdBy: string): Promise<SafeModule> {
    const existingModule = await this.db.module.findUnique({
      where: { nombre: input.nombre },
    });

    if (existingModule) {
      throw new HttpError(409, "MODULE_NAME_ALREADY_EXISTS", "El nombre del módulo ya existe");
    }

    return this.db.module.create({
      data: {
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        baseUrl: input.baseUrl ?? null,
        healthPath: input.healthPath ?? null,
        estado: Estado.ACTIVO,
        creadoPor: createdBy,
        actualizadoPor: createdBy,
      },
      select: moduleSelect,
    });
  }

  async update(id: string, input: UpdateModuleInput, updatedBy: string): Promise<SafeModule> {
    const module = await this.db.module.findUnique({
      where: { id },
    });

    if (!module) {
      throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
    }

    if (input.nombre && input.nombre !== module.nombre) {
      const existingModule = await this.db.module.findUnique({
        where: { nombre: input.nombre },
      });

      if (existingModule) {
        throw new HttpError(409, "MODULE_NAME_ALREADY_EXISTS", "El nombre del módulo ya existe");
      }
    }

    return this.db.module.update({
      where: { id },
      data: {
        ...(input.nombre ? { nombre: input.nombre } : {}),
        ...(input.descripcion !== undefined ? { descripcion: input.descripcion } : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.healthPath !== undefined ? { healthPath: input.healthPath } : {}),
        actualizadoPor: updatedBy,
      },
      select: moduleSelect,
    });
  }

  async delete(id: string, deletedBy: string): Promise<SafeModule> {
    const module = await this.db.module.findUnique({
      where: { id },
      include: {
        roleModules: {
          where: { estado: Estado.ACTIVO },
        },
        menus: {
          where: { estado: Estado.ACTIVO },
          include: {
            children: {
              where: { estado: Estado.ACTIVO },
            },
          },
        },
      },
    });

    if (!module) {
      throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
    }

    if (module.estado === Estado.INACTIVO) {
      throw new HttpError(400, "MODULE_ALREADY_INACTIVE", "El módulo ya está inactivo");
    }

    const leafMenus = module.menus.filter((menu) => menu.children.length === 0);
    const parentMenus = module.menus.filter((menu) => menu.children.length > 0);

    for (const menu of [...leafMenus, ...parentMenus]) {
      await this.db.roleMenu.updateMany({
        where: { menuId: menu.id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, actualizadoPor: deletedBy },
      });
      await this.db.menu.update({
        where: { id: menu.id },
        data: { estado: Estado.INACTIVO, actualizadoPor: deletedBy },
      });
    }

    if (module.roleModules.length > 0) {
      await this.db.roleModule.updateMany({
        where: { moduleId: id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, actualizadoPor: deletedBy },
      });
    }

    const archivedName = `${module.nombre}__archived__${Date.now()}`.slice(0, 100);

    return this.db.module.update({
      where: { id },
      data: {
        nombre: archivedName,
        estado: Estado.INACTIVO,
        actualizadoPor: deletedBy,
      },
      select: moduleSelect,
    });
  }

  async assignToRole(roleId: string, input: AssignModuleToRoleInput, assignedBy: string): Promise<void> {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    const module = await this.db.module.findUnique({
      where: { id: input.moduleId },
    });

    if (!module || module.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
    }

    const existingAssignment = await this.db.roleModule.findUnique({
      where: {
        roleId_moduleId: {
          roleId,
          moduleId: input.moduleId,
        },
      },
    });

    if (existingAssignment) {
      if (existingAssignment.estado === Estado.ACTIVO) {
        throw new HttpError(409, "ROLE_ALREADY_HAS_MODULE", "El rol ya tiene este módulo asignado");
      }

      await this.db.roleModule.update({
        where: { id: existingAssignment.id },
        data: {
          estado: Estado.ACTIVO,
          actualizadoPor: assignedBy,
        },
      });
      return;
    }

    await this.db.roleModule.create({
      data: {
        roleId,
        moduleId: input.moduleId,
        estado: Estado.ACTIVO,
        creadoPor: assignedBy,
        actualizadoPor: assignedBy,
      },
    });
  }
}
