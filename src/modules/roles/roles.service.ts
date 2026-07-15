import { Estado, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../common/http-error.js";
import type { CreateRoleInput, UpdateRoleInput, AssignUserToRoleInput, ListRolesInput } from "./roles.schemas.js";

type SafeRole = {
  id: string;
  nombre: string;
  descripcion: string | null;
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

export class RoleService {
  constructor(private readonly db: PrismaClient) {}

  async list(input: ListRolesInput): Promise<PaginatedResponse<SafeRole>> {
    const { page, limit, search, estado } = input;
    const skip = (page - 1) * limit;

    const where: {
      estado?: Estado;
      OR?: Array<{ nombre: { contains: string; mode: "insensitive" } } | { descripcion: { contains: string; mode: "insensitive" } }>;
    } = {};

    if (estado) {
      where.estado = estado;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { descripcion: { contains: search, mode: "insensitive" } },
      ];
    }

    const [roles, total] = await Promise.all([
      this.db.role.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          estado: true,
          fechaCreacion: true,
          fechaActualizacion: true,
          creadoPor: true,
          actualizadoPor: true,
        },
        orderBy: { fechaCreacion: "desc" },
      }),
      this.db.role.count({ where }),
    ]);

    return {
      data: roles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SafeRole> {
    const role = await this.db.role.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    if (!role) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    return role;
  }

  async create(input: CreateRoleInput, createdBy: string): Promise<SafeRole> {
    const existingRole = await this.db.role.findUnique({
      where: { nombre: input.nombre },
    });

    if (existingRole) {
      throw new HttpError(409, "ROLE_NAME_ALREADY_EXISTS", "El nombre del rol ya existe");
    }

    const role = await this.db.role.create({
      data: {
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        estado: Estado.ACTIVO,
        creadoPor: createdBy,
        actualizadoPor: createdBy,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return role;
  }

  async update(id: string, input: UpdateRoleInput, updatedBy: string): Promise<SafeRole> {
    const role = await this.db.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    if (input.nombre && input.nombre !== role.nombre) {
      const existingRole = await this.db.role.findUnique({
        where: { nombre: input.nombre },
      });

      if (existingRole) {
        throw new HttpError(409, "ROLE_NAME_ALREADY_EXISTS", "El nombre del rol ya existe");
      }
    }

    const updateData: {
      nombre?: string;
      descripcion?: string;
      estado?: Estado;
      actualizadoPor: string;
    } = {
      actualizadoPor: updatedBy,
    };

    if (input.nombre) updateData.nombre = input.nombre;
    if (input.descripcion !== undefined) updateData.descripcion = input.descripcion;
    if (input.estado) updateData.estado = input.estado;

    const updatedRole = await this.db.role.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return updatedRole;
  }

  async delete(id: string, deletedBy: string): Promise<SafeRole> {
    const role = await this.db.role.findUnique({
      where: { id },
      include: {
        userRoles: {
          where: { estado: Estado.ACTIVO },
        },
      },
    });

    if (!role) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    if (role.estado === Estado.INACTIVO) {
      throw new HttpError(400, "ROLE_ALREADY_INACTIVE", "El rol ya está inactivo");
    }

    if (role.userRoles.length > 0) {
      throw new HttpError(400, "ROLE_HAS_ACTIVE_USERS", "El rol tiene usuarios activos asignados");
    }

    const deletedRole = await this.db.role.update({
      where: { id },
      data: {
        estado: Estado.INACTIVO,
        actualizadoPor: deletedBy,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return deletedRole;
  }

  async assignUser(roleId: string, input: AssignUserToRoleInput, assignedBy: string): Promise<void> {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    const user = await this.db.user.findUnique({
      where: { id: input.userId },
    });

    if (!user || user.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    const existingAssignment = await this.db.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: input.userId,
          roleId,
        },
      },
    });

    if (existingAssignment) {
      if (existingAssignment.estado === Estado.ACTIVO) {
        throw new HttpError(409, "USER_ALREADY_HAS_ROLE", "El usuario ya tiene este rol asignado");
      }

      await this.db.userRole.update({
        where: { id: existingAssignment.id },
        data: {
          estado: Estado.ACTIVO,
          actualizadoPor: assignedBy,
        },
      });
    } else {
      await this.db.userRole.create({
        data: {
          userId: input.userId,
          roleId,
          estado: Estado.ACTIVO,
          creadoPor: assignedBy,
          actualizadoPor: assignedBy,
        },
      });
    }
  }

  async removeUser(roleId: string, userId: string, removedBy: string): Promise<void> {
    const userRole = await this.db.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!userRole) {
      throw new HttpError(404, "ASSIGNMENT_NOT_FOUND", "Asignación no encontrada");
    }

    if (userRole.estado === Estado.INACTIVO) {
      throw new HttpError(400, "ASSIGNMENT_ALREADY_INACTIVE", "La asignación ya está inactiva");
    }

    await this.db.userRole.update({
      where: { id: userRole.id },
      data: {
        estado: Estado.INACTIVO,
        actualizadoPor: removedBy,
      },
    });
  }
}
