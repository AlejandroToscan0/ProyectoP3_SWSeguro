import { Estado, type PrismaClient } from "@prisma/client";
import { HttpError } from "../../common/http-error.js";
import type { CreateMenuInput, UpdateMenuInput, AssignMenuToRoleInput, ListMenusInput } from "./menus.schemas.js";

type SafeMenu = {
  id: string;
  nombre: string;
  url: string | null;
  moduleId: string;
  parentId: string | null;
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

type MenuTreeNode = {
  id: string;
  nombre: string;
  url: string | null;
  moduleId: string;
  parentId: string | null;
  children: MenuTreeNode[];
};

export class MenuService {
  constructor(private readonly db: PrismaClient) {}

  async list(input: ListMenusInput): Promise<PaginatedResponse<SafeMenu>> {
    const { page, limit, search, estado, moduleId, parentId } = input;
    const skip = (page - 1) * limit;

    const where: {
      estado?: Estado;
      moduleId?: string;
      parentId?: string | null;
      OR?: Array<{ nombre: { contains: string; mode: "insensitive" } } | { url: { contains: string; mode: "insensitive" } }>;
    } = {};

    if (estado) {
      where.estado = estado;
    }

    if (moduleId) {
      where.moduleId = moduleId;
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { url: { contains: search, mode: "insensitive" } },
      ];
    }

    const [menus, total] = await Promise.all([
      this.db.menu.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          nombre: true,
          url: true,
          moduleId: true,
          parentId: true,
          estado: true,
          fechaCreacion: true,
          fechaActualizacion: true,
          creadoPor: true,
          actualizadoPor: true,
        },
        orderBy: { fechaCreacion: "desc" },
      }),
      this.db.menu.count({ where }),
    ]);

    return {
      data: menus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SafeMenu> {
    const menu = await this.db.menu.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        url: true,
        moduleId: true,
        parentId: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    if (!menu) {
      throw new HttpError(404, "MENU_NOT_FOUND", "Menú no encontrado");
    }

    return menu;
  }

  private async wouldCreateCycle(menuId: string | null, newParentId: string | null): Promise<boolean> {
    if (!newParentId || newParentId === menuId) {
      return false;
    }

    let currentId: string | null = newParentId;
    const visited = new Set<string>();
    const maxDepth = 100;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (currentId === menuId) {
        return true;
      }

      if (visited.has(currentId)) {
        return true;
      }

      visited.add(currentId);

      const parent = await this.db.menu.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      }) as { parentId: string | null } | null;

      currentId = parent?.parentId ?? null;
      depth++;
    }

    return depth >= maxDepth;
  }

  async create(input: CreateMenuInput, createdBy: string): Promise<SafeMenu> {
    const module = await this.db.module.findUnique({
      where: { id: input.moduleId },
    });

    if (!module || module.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
    }

    if (input.parentId) {
      const parent = await this.db.menu.findUnique({
        where: { id: input.parentId },
      });

      if (!parent || parent.estado !== Estado.ACTIVO) {
        throw new HttpError(404, "PARENT_MENU_NOT_FOUND", "Menú padre no encontrado");
      }

      if (parent.moduleId !== input.moduleId) {
        throw new HttpError(400, "INVALID_PARENT_MODULE", "El menú padre debe pertenecer al mismo módulo");
      }
    }

    const wouldCreateCycle = await this.wouldCreateCycle(null, input.parentId ?? null);
    if (wouldCreateCycle) {
      throw new HttpError(400, "WOULD_CREATE_CYCLE", "Esta asignación crearía un ciclo en la jerarquía");
    }

    const menu = await this.db.menu.create({
      data: {
        nombre: input.nombre,
        url: input.url ?? null,
        moduleId: input.moduleId,
        parentId: input.parentId ?? null,
        estado: Estado.ACTIVO,
        creadoPor: createdBy,
        actualizadoPor: createdBy,
      },
      select: {
        id: true,
        nombre: true,
        url: true,
        moduleId: true,
        parentId: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return menu;
  }

  async update(id: string, input: UpdateMenuInput, updatedBy: string): Promise<SafeMenu> {
    const menu = await this.db.menu.findUnique({
      where: { id },
    });

    if (!menu) {
      throw new HttpError(404, "MENU_NOT_FOUND", "Menú no encontrado");
    }

    if (input.moduleId) {
      const module = await this.db.module.findUnique({
        where: { id: input.moduleId },
      });

      if (!module || module.estado !== Estado.ACTIVO) {
        throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
      }
    }

    if (input.parentId !== undefined) {
      if (input.parentId) {
        const parent = await this.db.menu.findUnique({
          where: { id: input.parentId },
        });

        if (!parent || parent.estado !== Estado.ACTIVO) {
          throw new HttpError(404, "PARENT_MENU_NOT_FOUND", "Menú padre no encontrado");
        }

        const targetModuleId = input.moduleId ?? menu.moduleId;
        if (parent.moduleId !== targetModuleId) {
          throw new HttpError(400, "INVALID_PARENT_MODULE", "El menú padre debe pertenecer al mismo módulo");
        }
      }

      const wouldCreateCycle = await this.wouldCreateCycle(id, input.parentId ?? null);
      if (wouldCreateCycle) {
        throw new HttpError(400, "WOULD_CREATE_CYCLE", "Esta asignación crearía un ciclo en la jerarquía");
      }
    }

    const updateData: {
      nombre?: string;
      url?: string | null;
      moduleId?: string;
      parentId?: string | null;
      estado?: Estado;
      actualizadoPor: string;
    } = {
      actualizadoPor: updatedBy,
    };

    if (input.nombre) updateData.nombre = input.nombre;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.moduleId) updateData.moduleId = input.moduleId;
    if (input.parentId !== undefined) updateData.parentId = input.parentId;
    if (input.estado) updateData.estado = input.estado;

    const updatedMenu = await this.db.menu.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        url: true,
        moduleId: true,
        parentId: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return updatedMenu;
  }

  async delete(id: string, deletedBy: string): Promise<SafeMenu> {
    const menu = await this.db.menu.findUnique({
      where: { id },
      include: {
        children: {
          where: { estado: Estado.ACTIVO },
        },
        roleMenus: {
          where: { estado: Estado.ACTIVO },
        },
      },
    });

    if (!menu) {
      throw new HttpError(404, "MENU_NOT_FOUND", "Menú no encontrado");
    }

    if (menu.estado === Estado.INACTIVO) {
      throw new HttpError(400, "MENU_ALREADY_INACTIVE", "El menú ya está inactivo");
    }

    if (menu.children.length > 0) {
      throw new HttpError(400, "MENU_HAS_ACTIVE_CHILDREN", "El menú tiene hijos activos");
    }

    if (menu.roleMenus.length > 0) {
      throw new HttpError(400, "MENU_HAS_ACTIVE_ROLES", "El menú tiene roles activos asignados");
    }

    const deletedMenu = await this.db.menu.update({
      where: { id },
      data: {
        estado: Estado.INACTIVO,
        actualizadoPor: deletedBy,
      },
      select: {
        id: true,
        nombre: true,
        url: true,
        moduleId: true,
        parentId: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        creadoPor: true,
        actualizadoPor: true,
      },
    });

    return deletedMenu;
  }

  async assignToRole(roleId: string, input: AssignMenuToRoleInput, assignedBy: string): Promise<void> {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    const menu = await this.db.menu.findUnique({
      where: { id: input.menuId },
    });

    if (!menu || menu.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "MENU_NOT_FOUND", "Menú no encontrado");
    }

    const existingAssignment = await this.db.roleMenu.findUnique({
      where: {
        roleId_menuId: {
          roleId,
          menuId: input.menuId,
        },
      },
    });

    if (existingAssignment) {
      if (existingAssignment.estado === Estado.ACTIVO) {
        throw new HttpError(409, "ROLE_ALREADY_HAS_MENU", "El rol ya tiene este menú asignado");
      }

      await this.db.roleMenu.update({
        where: { id: existingAssignment.id },
        data: {
          estado: Estado.ACTIVO,
          actualizadoPor: assignedBy,
        },
      });
    } else {
      await this.db.roleMenu.create({
        data: {
          roleId,
          menuId: input.menuId,
          estado: Estado.ACTIVO,
          creadoPor: assignedBy,
          actualizadoPor: assignedBy,
        },
      });
    }
  }

  async getTreeForRole(roleId: string): Promise<MenuTreeNode[]> {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
      include: {
        roleMenus: {
          where: { estado: Estado.ACTIVO },
          include: {
            menu: {
              where: { estado: Estado.ACTIVO },
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    if (!role || role.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    const menuIds = role.roleMenus
      .map((rm: { menu: { id: string } }) => rm.menu.id)
      .filter((id: unknown): id is string => typeof id === "string");

    if (menuIds.length === 0) {
      return [];
    }

    const allMenus = await this.db.menu.findMany({
      where: {
        id: { in: menuIds },
        estado: Estado.ACTIVO,
      },
      orderBy: { nombre: "asc" },
    });

    const menuMap = new Map<string, MenuTreeNode>();
    const rootMenus: MenuTreeNode[] = [];

    for (const menu of allMenus) {
      menuMap.set(menu.id, {
        id: menu.id,
        nombre: menu.nombre,
        url: menu.url,
        moduleId: menu.moduleId,
        parentId: menu.parentId,
        children: [],
      });
    }

    for (const menu of allMenus) {
      const node = menuMap.get(menu.id);
      if (!node) continue;

      if (menu.parentId && menuMap.has(menu.parentId)) {
        const parent: MenuTreeNode | undefined = menuMap.get(menu.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootMenus.push(node);
      }
    }

    return rootMenus;
  }
}
