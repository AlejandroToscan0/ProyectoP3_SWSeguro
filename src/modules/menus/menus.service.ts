import { Estado, Prisma, type PrismaClient } from "@prisma/client";
import { canAccessMenuUrl } from "../../common/menu-access.js";
import { HttpError } from "../../common/http-error.js";
import type { CreateMenuInput, UpdateMenuInput, AssignMenuToRoleInput, ListMenusInput } from "./menus.schemas.js";

type SafeMenu = {
  id: string;
  nombre: string;
  url: string | null;
  moduleId: string;
  parentId: string | null;
  orden: number;
  icono: string | null;
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
  orden: number;
  icono: string | null;
  children: MenuTreeNode[];
};

type CteMenuRow = {
  id: string;
  nombre: string;
  url: string | null;
  moduleId: string;
  parentId: string | null;
  orden: number;
  icono: string | null;
  moduleNombre: string;
  directlyAssigned: boolean;
};

const menuSelect = {
  id: true,
  nombre: true,
  url: true,
  moduleId: true,
  parentId: true,
  orden: true,
  icono: true,
  estado: true,
  fechaCreacion: true,
  fechaActualizacion: true,
  creadoPor: true,
  actualizadoPor: true,
} as const;

export class MenuService {
  constructor(private readonly db: PrismaClient) {}

  async list(input: ListMenusInput): Promise<PaginatedResponse<SafeMenu>> {
    const { page, limit, search, estado, moduleId, parentId } = input;
    const skip = (page - 1) * limit;

    const where: Prisma.MenuWhereInput = {
      estado,
    };

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
        select: menuSelect,
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
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
      select: menuSelect,
    });

    if (!menu) {
      throw new HttpError(404, "MENU_NOT_FOUND", "Menú no encontrado");
    }

    return menu;
  }

  private async wouldCreateCycle(menuId: string, newParentId: string | null): Promise<boolean> {
    if (!newParentId) {
      return false;
    }

    if (newParentId === menuId) {
      return true;
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

      const parent: { parentId: string | null } | null = await this.db.menu.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      currentId = parent?.parentId ?? null;
      depth++;
    }

    return depth >= maxDepth;
  }

  private async assertLeafUrlRules(params: {
    menuId?: string;
    url: string | null;
    parentId: string | null;
  }): Promise<void> {
    if (params.menuId) {
      const activeChildren = await this.db.menu.count({
        where: {
          parentId: params.menuId,
          estado: Estado.ACTIVO,
        },
      });

      if (activeChildren > 0 && params.url) {
        throw new HttpError(
          400,
          "NON_LEAF_CANNOT_HAVE_URL",
          "Solo los nodos hoja pueden tener URL",
        );
      }
    }

    if (params.parentId && params.url === null) {
      // Intermediate nodes are allowed without URL; no extra check.
    }

    if (params.parentId) {
      const parent = await this.db.menu.findUnique({
        where: { id: params.parentId },
        select: { url: true, estado: true },
      });

      if (parent?.url) {
        throw new HttpError(
          400,
          "PARENT_MUST_BE_INTERMEDIATE",
          "El menú padre no puede tener URL; solo los nodos hoja pueden tenerla",
        );
      }
    }
  }

  async create(input: CreateMenuInput, createdBy: string): Promise<SafeMenu> {
    const module = await this.db.module.findUnique({
      where: { id: input.moduleId },
    });

    if (!module || module.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "MODULE_NOT_FOUND", "Módulo no encontrado");
    }

    const parentId = input.parentId ?? null;
    const url = input.url ?? null;

    if (parentId) {
      const parent = await this.db.menu.findUnique({
        where: { id: parentId },
      });

      if (!parent || parent.estado !== Estado.ACTIVO) {
        throw new HttpError(404, "PARENT_MENU_NOT_FOUND", "Menú padre no encontrado");
      }

      if (parent.moduleId !== input.moduleId) {
        throw new HttpError(400, "INVALID_PARENT_MODULE", "El menú padre debe pertenecer al mismo módulo");
      }
    }

    await this.assertLeafUrlRules({ url, parentId });

    const menu = await this.db.menu.create({
      data: {
        nombre: input.nombre,
        url,
        moduleId: input.moduleId,
        parentId,
        orden: input.orden ?? 0,
        icono: input.icono ?? null,
        estado: Estado.ACTIVO,
        creadoPor: createdBy,
        actualizadoPor: createdBy,
      },
      select: menuSelect,
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

    const nextParentId = input.parentId !== undefined ? input.parentId : menu.parentId;
    const nextUrl = input.url !== undefined ? input.url : menu.url;
    const nextModuleId = input.moduleId ?? menu.moduleId;

    if (nextParentId) {
      const parent = await this.db.menu.findUnique({
        where: { id: nextParentId },
      });

      if (!parent || parent.estado !== Estado.ACTIVO) {
        throw new HttpError(404, "PARENT_MENU_NOT_FOUND", "Menú padre no encontrado");
      }

      if (parent.moduleId !== nextModuleId) {
        throw new HttpError(400, "INVALID_PARENT_MODULE", "El menú padre debe pertenecer al mismo módulo");
      }

      const wouldCreateCycle = await this.wouldCreateCycle(id, nextParentId);
      if (wouldCreateCycle) {
        throw new HttpError(400, "WOULD_CREATE_CYCLE", "Esta asignación crearía un ciclo en la jerarquía");
      }
    }

    await this.assertLeafUrlRules({
      menuId: id,
      url: nextUrl,
      parentId: nextParentId,
    });

    const updateData: Prisma.MenuUpdateInput = {
      actualizadoPor: updatedBy,
    };

    if (input.nombre) updateData.nombre = input.nombre;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.moduleId) {
      updateData.module = { connect: { id: input.moduleId } };
    }
    if (input.parentId !== undefined) {
      updateData.parent = input.parentId
        ? { connect: { id: input.parentId } }
        : { disconnect: true };
    }
    if (input.orden !== undefined) updateData.orden = input.orden;
    if (input.icono !== undefined) updateData.icono = input.icono;

    const updatedMenu = await this.db.menu.update({
      where: { id },
      data: updateData,
      select: menuSelect,
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
      await this.db.roleMenu.updateMany({
        where: { menuId: id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, actualizadoPor: deletedBy },
      });
    }

    const deletedMenu = await this.db.menu.update({
      where: { id },
      data: {
        estado: Estado.INACTIVO,
        actualizadoPor: deletedBy,
      },
      select: menuSelect,
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
      include: { module: true },
    });

    if (!menu || menu.estado !== Estado.ACTIVO || menu.module.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "MENU_NOT_FOUND", "Menú no encontrado");
    }

    const roleModule = await this.db.roleModule.findUnique({
      where: {
        roleId_moduleId: {
          roleId,
          moduleId: menu.moduleId,
        },
      },
    });

    if (!roleModule || roleModule.estado !== Estado.ACTIVO) {
      throw new HttpError(
        400,
        "MODULE_NOT_ASSIGNED_TO_ROLE",
        "Asigna primero el módulo al rol antes de asignar sus menús",
      );
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
      return;
    }

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

  async getTreeForRole(roleId: string): Promise<MenuTreeNode[]> {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
      select: { id: true, estado: true },
    });

    if (!role || role.estado !== Estado.ACTIVO) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Rol no encontrado");
    }

    const permissionRows = await this.db.rolePermission.findMany({
      where: {
        roleId,
        estado: Estado.ACTIVO,
        permission: { estado: Estado.ACTIVO },
      },
      select: {
        permission: { select: { codigo: true } },
      },
    });
    const permissionCodes = new Set(permissionRows.map((row) => row.permission.codigo));

    const catalogRows = await this.db.permission.findMany({
      where: { estado: Estado.ACTIVO },
      select: { codigo: true },
    });
    const catalogPermissions = new Set(catalogRows.map((row) => row.codigo));

    const rows = await this.db.$queryRaw<CteMenuRow[]>(Prisma.sql`
      WITH RECURSIVE menu_tree AS (
        SELECT
          m.id,
          m.nombre,
          m.url,
          m."moduleId",
          m."parentId",
          m.orden,
          m.icono,
          mod.nombre AS "moduleNombre",
          TRUE AS "directlyAssigned"
        FROM "Menu" m
        INNER JOIN "RoleMenu" rm ON rm."menuId" = m.id
        INNER JOIN "Module" mod ON mod.id = m."moduleId"
        INNER JOIN "RoleModule" rmod
          ON rmod."moduleId" = m."moduleId"
          AND rmod."roleId" = ${roleId}::text
          AND rmod.estado = 'ACTIVO'::"Estado"
        WHERE rm."roleId" = ${roleId}::text
          AND rm.estado = 'ACTIVO'::"Estado"
          AND m.estado = 'ACTIVO'::"Estado"
          AND mod.estado = 'ACTIVO'::"Estado"

        UNION

        SELECT
          p.id,
          p.nombre,
          p.url,
          p."moduleId",
          p."parentId",
          p.orden,
          p.icono,
          mod.nombre AS "moduleNombre",
          FALSE AS "directlyAssigned"
        FROM "Menu" p
        INNER JOIN menu_tree child ON child."parentId" = p.id
        INNER JOIN "Module" mod ON mod.id = p."moduleId"
        INNER JOIN "RoleModule" rmod
          ON rmod."moduleId" = p."moduleId"
          AND rmod."roleId" = ${roleId}::text
          AND rmod.estado = 'ACTIVO'::"Estado"
        WHERE p.estado = 'ACTIVO'::"Estado"
          AND mod.estado = 'ACTIVO'::"Estado"
      )
      SELECT DISTINCT
        id,
        nombre,
        url,
        "moduleId",
        "parentId",
        orden,
        icono,
        "moduleNombre",
        BOOL_OR("directlyAssigned") AS "directlyAssigned"
      FROM menu_tree
      GROUP BY id, nombre, url, "moduleId", "parentId", orden, icono, "moduleNombre"
      ORDER BY orden ASC, nombre ASC
    `);

    if (rows.length === 0) {
      return [];
    }

    const menuMap = new Map<string, MenuTreeNode>();
    const rootMenus: MenuTreeNode[] = [];

    for (const menu of rows) {
      let safeUrl: string | null = null;
      if (menu.url) {
        const allowed =
          Boolean(menu.directlyAssigned) &&
          canAccessMenuUrl(menu.url, permissionCodes, menu.moduleNombre, catalogPermissions);
        if (!allowed) {
          // Asignado pero sin permiso: no mostrar. Ancestro con URL: solo como grupo.
          if (menu.directlyAssigned) continue;
          safeUrl = null;
        } else {
          safeUrl = menu.url;
        }
      }

      menuMap.set(menu.id, {
        id: menu.id,
        nombre: menu.nombre,
        url: safeUrl,
        moduleId: menu.moduleId,
        parentId: menu.parentId,
        orden: menu.orden,
        icono: menu.icono,
        children: [],
      });
    }

    for (const menu of rows) {
      const node = menuMap.get(menu.id);
      if (!node) continue;

      if (menu.parentId && menuMap.has(menu.parentId)) {
        const parent = menuMap.get(menu.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootMenus.push(node);
      }
    }

    const pruneEmptyGroups = (nodes: MenuTreeNode[]): MenuTreeNode[] => {
      const kept: MenuTreeNode[] = [];
      for (const node of nodes) {
        const children = pruneEmptyGroups(node.children);
        if (node.url || children.length > 0) {
          kept.push({ ...node, children });
        }
      }
      return kept;
    };

    const sortRecursive = (nodes: MenuTreeNode[]): void => {
      nodes.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
      for (const node of nodes) {
        sortRecursive(node.children);
      }
    };

    const pruned = pruneEmptyGroups(rootMenus);
    sortRecursive(pruned);
    return pruned;
  }
}
