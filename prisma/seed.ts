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

  const permissions = ["AUTH_LOGIN", "AUTH_SELECT_ROLE", "USERS_READ", "ROLES_READ"];
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
