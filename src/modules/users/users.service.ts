import argon2 from "argon2";
import { Estado, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../common/http-error.js";
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from "./users.schemas.js";

type SafeUser = {
  id: string;
  nombre: string;
  email: string;
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

export class UserService {
  constructor(private readonly db: PrismaClient) {}

  async list(input: ListUsersInput): Promise<PaginatedResponse<SafeUser>> {
    const { page, limit, search, estado } = input;
    const skip = (page - 1) * limit;

    const where: {
      estado?: Estado;
      OR?: Array<{ nombre: { contains: string; mode: "insensitive" } } | { email: { contains: string; mode: "insensitive" } }>;
    } = {};

    if (estado) {
      where.estado = estado;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          nombre: true,
          email: true,
          estado: true,
          fechaCreacion: true,
          fechaActualizacion: true,
          creadoPor: true,
          actualizadoPor: true,
        },
        orderBy: { fechaCreacion: "desc" },
      }),
      this.db.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    return user;
  }

  async create(input: CreateUserInput, createdBy: string): Promise<SafeUser> {
    const existingUser = await this.db.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new HttpError(409, "EMAIL_ALREADY_EXISTS", "El email ya está registrado");
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.db.user.create({
      data: {
        nombre: input.nombre,
        email: input.email.toLowerCase(),
        passwordHash,
        estado: Estado.ACTIVO,
        creadoPor: createdBy,
        actualizadoPor: createdBy,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return user;
  }

  async update(id: string, input: UpdateUserInput, updatedBy: string): Promise<SafeUser> {
    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    if (input.email && input.email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await this.db.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (existingUser) {
        throw new HttpError(409, "EMAIL_ALREADY_EXISTS", "El email ya está registrado");
      }
    }

    const updateData: {
      nombre?: string;
      email?: string;
      passwordHash?: string;
      estado?: Estado;
      actualizadoPor: string;
    } = {
      actualizadoPor: updatedBy,
    };

    if (input.nombre) updateData.nombre = input.nombre;
    if (input.email) updateData.email = input.email.toLowerCase();
    if (input.password) updateData.passwordHash = await argon2.hash(input.password);
    if (input.estado) updateData.estado = input.estado;

    const updatedUser = await this.db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return updatedUser;
  }

  async delete(id: string, deletedBy: string): Promise<SafeUser> {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          where: { estado: Estado.ACTIVO },
        },
      },
    });

    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "Usuario no encontrado");
    }

    if (user.estado === Estado.INACTIVO) {
      throw new HttpError(400, "USER_ALREADY_INACTIVE", "El usuario ya está inactivo");
    }

    if (user.userRoles.length > 0) {
      throw new HttpError(400, "USER_HAS_ACTIVE_ROLES", "El usuario tiene roles activos asignados");
    }

    const deletedUser = await this.db.user.update({
      where: { id },
      data: {
        estado: Estado.INACTIVO,
        actualizadoPor: deletedBy,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return deletedUser;
  }
}
