/**
 * Roles y usuarios demo para probar selector de rol y Least Privilege.
 * Idempotente: se puede ejecutar tras el seed principal.
 */
import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient, Estado, type PrismaClient as PrismaClientType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL es requerido para ejecutar el seed demo");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const defaultPrisma = new PrismaClient({ adapter });

export async function seedDemoRoles(db: PrismaClientType = defaultPrisma) {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error(`No existe el admin ${adminEmail}. Ejecuta primero npm run prisma:seed`);
  }

  const permissionMap = new Map<string, string>();
  for (const codigo of [
    "AUTH_LOGIN",
    "AUTH_SELECT_ROLE",
    "USERS_READ",
    "ROLES_READ",
    "MODULES_READ",
    "MENUS_READ",
    "VENTAS_READ",
    "VENTAS_CREATE",
    "RESERVAS_READ",
    "RESERVAS_CREATE",
  ]) {
    const permission = await db.permission.upsert({
      where: { codigo },
      update: { estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
      create: {
        codigo,
        descripcion: `Permiso ${codigo}`,
        estado: Estado.ACTIVO,
        creadoPor: "seed-demo",
        actualizadoPor: "seed-demo",
      },
    });
    permissionMap.set(codigo, permission.id);
  }

  async function upsertRole(nombre: string, descripcion: string) {
    return db.role.upsert({
      where: { nombre },
      update: { descripcion, estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
      create: {
        nombre,
        descripcion,
        estado: Estado.ACTIVO,
        creadoPor: "seed-demo",
        actualizadoPor: "seed-demo",
      },
    });
  }

  async function linkPerms(roleId: string, codes: string[]) {
    for (const code of codes) {
      const permissionId = permissionMap.get(code);
      if (!permissionId) continue;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: { estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
        create: {
          roleId,
          permissionId,
          estado: Estado.ACTIVO,
          creadoPor: "seed-demo",
          actualizadoPor: "seed-demo",
        },
      });
    }
  }

  async function linkModule(roleId: string, moduleName: string) {
    const module = await db.module.findUnique({ where: { nombre: moduleName } });
    if (!module) return;
    await db.roleModule.upsert({
      where: { roleId_moduleId: { roleId, moduleId: module.id } },
      update: { estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
      create: {
        roleId,
        moduleId: module.id,
        estado: Estado.ACTIVO,
        creadoPor: "seed-demo",
        actualizadoPor: "seed-demo",
      },
    });
  }

  async function linkMenu(roleId: string, menuId: string) {
    const menu = await db.menu.findUnique({ where: { id: menuId } });
    if (!menu) return;
    await db.roleMenu.upsert({
      where: { roleId_menuId: { roleId, menuId } },
      update: { estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
      create: {
        roleId,
        menuId,
        estado: Estado.ACTIVO,
        creadoPor: "seed-demo",
        actualizadoPor: "seed-demo",
      },
    });
  }

  async function linkUser(userId: string, roleId: string) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
      create: {
        userId,
        roleId,
        estado: Estado.ACTIVO,
        creadoPor: "seed-demo",
        actualizadoPor: "seed-demo",
      },
    });
  }

  async function ensureDemoUser(nombre: string, email: string, password: string) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return db.user.update({
        where: { id: existing.id },
        data: { estado: Estado.ACTIVO, actualizadoPor: "seed-demo" },
      });
    }
    return db.user.create({
      data: {
        nombre,
        email,
        passwordHash: await argon2.hash(password),
        estado: Estado.ACTIVO,
        creadoPor: "seed-demo",
        actualizadoPor: "seed-demo",
      },
    });
  }

  const vendedor = await upsertRole("VENDEDOR", "Operación de ventas (Least Privilege)");
  await linkPerms(vendedor.id, ["AUTH_LOGIN", "AUTH_SELECT_ROLE", "VENTAS_READ", "VENTAS_CREATE"]);
  await linkModule(vendedor.id, "Ventas");
  await linkMenu(vendedor.id, "menu-ventas");
  await linkUser(admin.id, vendedor.id);

  const auditor = await upsertRole("AUDITOR", "Solo lectura de administración y ventas");
  await linkPerms(auditor.id, [
    "AUTH_LOGIN",
    "AUTH_SELECT_ROLE",
    "USERS_READ",
    "ROLES_READ",
    "MODULES_READ",
    "MENUS_READ",
    "VENTAS_READ",
  ]);
  await linkModule(auditor.id, "Administración");
  await linkModule(auditor.id, "Ventas");
  await linkMenu(auditor.id, "menu-usuarios");
  await linkMenu(auditor.id, "menu-roles");
  await linkMenu(auditor.id, "menu-modulos");
  await linkMenu(auditor.id, "menu-menus");
  await linkMenu(auditor.id, "menu-ventas");
  await linkUser(admin.id, auditor.id);

  const vendedorUser = await ensureDemoUser("Vendedor Demo", "vendedor@example.com", "ChangeMe123!");
  await linkUser(vendedorUser.id, vendedor.id);

  const auditorUser = await ensureDemoUser("Auditor Demo", "auditor@example.com", "ChangeMe123!");
  await linkUser(auditorUser.id, auditor.id);

  console.log("Seed demo roles completado:");
  console.log("  - Roles: VENDEDOR, AUDITOR (también asignados a admin)");
  console.log("  - Usuarios: vendedor@example.com / auditor@example.com (ChangeMe123!)");
}

async function main() {
  await seedDemoRoles();
}

const isDirectRun = process.argv[1]?.includes("seed-demo-roles");
if (isDirectRun) {
  main()
    .catch((error) => {
      console.error("Error en seed demo roles:", error);
      process.exit(1);
    })
    .finally(async () => {
      await defaultPrisma.$disconnect();
    });
}
