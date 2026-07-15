import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Estado, PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL es requerido para ejecutar el seed");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const defaultRoleName = process.env.SEED_DEFAULT_ROLE ?? "ADMIN";

  const passwordHash = await argon2.hash(adminPassword);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      nombre: adminName,
      passwordHash,
      estado: Estado.ACTIVO,
      actualizadoPor: "seed",
    },
    create: {
      nombre: adminName,
      email: adminEmail,
      passwordHash,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  const role = await prisma.role.upsert({
    where: { nombre: defaultRoleName },
    update: {
      estado: Estado.ACTIVO,
      actualizadoPor: "seed",
    },
    create: {
      nombre: defaultRoleName,
      descripcion: "Rol administrador inicial",
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      userId: user.id,
      roleId: role.id,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  const permissions = ["AUTH_LOGIN", "AUTH_SELECT_ROLE", "USERS_READ", "USERS_CREATE", "USERS_UPDATE", "USERS_DELETE", "ROLES_READ", "ROLES_CREATE", "ROLES_UPDATE", "ROLES_DELETE", "ROLES_ASSIGN_USER", "ROLES_REMOVE_USER", "MODULES_READ", "MODULES_CREATE", "MODULES_UPDATE", "MODULES_DELETE", "MENUS_READ", "MENUS_CREATE", "MENUS_UPDATE", "MENUS_DELETE", "ROLES_ASSIGN_MODULE", "ROLES_ASSIGN_MENU"];
  for (const code of permissions) {
    const permission = await prisma.permission.upsert({
      where: { codigo: code },
      update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
      create: {
        codigo: code,
        descripcion: `Permiso ${code}`,
        estado: Estado.ACTIVO,
        creadoPor: "seed",
        actualizadoPor: "seed",
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
      create: {
        roleId: role.id,
        permissionId: permission.id,
        estado: Estado.ACTIVO,
        creadoPor: "seed",
        actualizadoPor: "seed",
      },
    });
  }

  const module = await prisma.module.upsert({
    where: { nombre: "Administración" },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      nombre: "Administración",
      descripcion: "Módulo de administración del sistema",
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  await prisma.roleModule.upsert({
    where: {
      roleId_moduleId: {
        roleId: role.id,
        moduleId: module.id,
      },
    },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      roleId: role.id,
      moduleId: module.id,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  const menuUsuarios = await prisma.menu.upsert({
    where: { id: "menu-usuarios" },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      id: "menu-usuarios",
      nombre: "Usuarios",
      url: "/usuarios",
      moduleId: module.id,
      parentId: null,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  await prisma.roleMenu.upsert({
    where: {
      roleId_menuId: {
        roleId: role.id,
        menuId: menuUsuarios.id,
      },
    },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      roleId: role.id,
      menuId: menuUsuarios.id,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  const menuRoles = await prisma.menu.upsert({
    where: { id: "menu-roles" },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      id: "menu-roles",
      nombre: "Roles",
      url: "/roles",
      moduleId: module.id,
      parentId: null,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  await prisma.roleMenu.upsert({
    where: {
      roleId_menuId: {
        roleId: role.id,
        menuId: menuRoles.id,
      },
    },
    update: { estado: Estado.ACTIVO, actualizadoPor: "seed" },
    create: {
      roleId: role.id,
      menuId: menuRoles.id,
      estado: Estado.ACTIVO,
      creadoPor: "seed",
      actualizadoPor: "seed",
    },
  });

  console.log("Seed completado correctamente");
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
