import { AuditAction, Estado, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../common/http-error.js";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  AssignUserToRoleInput,
  AssignPermissionToRoleInput,
  ListRolesInput,
} from "./roles.schemas.js";

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

    where.estado = estado;

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

  async findDetail(id: string) {
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
        userRoles: {
          where: { estado: Estado.ACTIVO },
          select: {
            user: {
              select: { id: true, nombre: true, email: true, estado: true },
            },
          },
        },
        rolePermissions: {
          where: { estado: Estado.ACTIVO },
          select: {
            permission: {
              select: { id: true, codigo: true, descripcion: true },
            },
          },
        },
        roleModules: {
          where: { estado: Estado.ACTIVO },
          select: {
            module: {
              select: { id: true, nombre: true, descripcion: true },
            },
          },
        },
        roleMenus: {
          where: { estado: Estado.ACTIVO },
          select: {
            menu: {
              select: { id: true, nombre: true, url: true, parentId: true, orden: true },
            },
          },
        },
      },
    });

    if (!role) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    return {
      id: role.id,
      nombre: role.nombre,
      descripcion: role.descripcion,
      estado: role.estado,
      fechaCreacion: role.fechaCreacion,
      fechaActualizacion: role.fechaActualizacion,
      creadoPor: role.creadoPor,
      actualizadoPor: role.actualizadoPor,
      users: role.userRoles.map((item) => item.user),
      permissions: role.rolePermissions.map((item) => item.permission),
      modules: role.roleModules.map((item) => item.module),
      menus: role.roleMenus.map((item) => item.menu),
    };
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
      descripcion?: string | null;
      actualizadoPor: string;
    } = {
      actualizadoPor: updatedBy,
    };

    if (input.nombre) updateData.nombre = input.nombre;
    if (input.descripcion !== undefined) updateData.descripcion = input.descripcion ?? null;

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

  async assignPermission(roleId: string, input: AssignPermissionToRoleInput, assignedBy: string): Promise<void> {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    const permission = await this.db.permission.findUnique({
      where: { id: input.permissionId },
    });

    if (!permission || permission.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "PERMISSION_NOT_FOUND", "Permiso no encontrado");
    }

    const existingAssignment = await this.db.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: input.permissionId,
        },
      },
    });

    if (existingAssignment) {
      if (existingAssignment.estado === Estado.ACTIVO) {
        throw new HttpError(409, "ROLE_ALREADY_HAS_PERMISSION", "El rol ya tiene este permiso asignado");
      }

      await this.db.rolePermission.update({
        where: { id: existingAssignment.id },
        data: {
          estado: Estado.ACTIVO,
          actualizadoPor: assignedBy,
        },
      });

      await this.db.auditLog.create({
        data: {
          roleId,
          action: AuditAction.PERMISSIONS_CHANGED,
          detail: `Permiso reactivado: ${permission.codigo}`,
          creadoPor: assignedBy,
          actualizadoPor: assignedBy,
        },
      });
      return;
    }

    await this.db.rolePermission.create({
      data: {
        roleId,
        permissionId: input.permissionId,
        estado: Estado.ACTIVO,
        creadoPor: assignedBy,
        actualizadoPor: assignedBy,
      },
    });

    await this.db.auditLog.create({
      data: {
        roleId,
        action: AuditAction.PERMISSIONS_CHANGED,
        detail: `Permiso asignado: ${permission.codigo}`,
        creadoPor: assignedBy,
        actualizadoPor: assignedBy,
      },
    });
  }

  async removePermission(roleId: string, permissionId: string, removedBy: string): Promise<void> {
    const assignment = await this.db.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
      include: { permission: true },
    });

    if (!assignment || assignment.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_PERMISSION_NOT_FOUND", "El rol no tiene este permiso activo");
    }

    await this.db.rolePermission.update({
      where: { id: assignment.id },
      data: {
        estado: Estado.INACTIVO,
        actualizadoPor: removedBy,
      },
    });

    await this.db.auditLog.create({
      data: {
        roleId,
        action: AuditAction.PERMISSIONS_CHANGED,
        detail: `Permiso removido: ${assignment.permission.codigo}`,
        creadoPor: removedBy,
        actualizadoPor: removedBy,
      },
    });
  }
}
