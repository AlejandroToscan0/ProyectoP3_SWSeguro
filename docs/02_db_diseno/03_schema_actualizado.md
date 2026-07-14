# Actualización del schema físico — primera implementación del modelo aprobado

Este documento registra la primera actualización de `prisma/schema.prisma` a partir del modelo conceptual definido en [02_nuevo_modelo_datos.md](./02_nuevo_modelo_datos.md).

---

## Resumen de cambios

- Se incorporó el modelo funcional RBAC completo: `User → UserRole → Role → RoleModule → Module → Menu → Menu (parentId)`.
- Se crearon tres modelos nuevos: `Module`, `RoleModule`, `Menu`.
- Se eliminaron `Permission` y `RolePermission` del schema, por quedar fuera del modelo funcional aprobado.
- Se mantuvieron intactos `User`, `Role`, `UserRole`, `RefreshToken`, `TokenRevocation` y `AuditLog` como ya estaban modelados (infraestructura técnica + entidades funcionales ya vigentes).
- Se realizó un ajuste mínimo y necesario en `src/modules/auth/auth.service.ts` para que el proyecto compile tras eliminar `Permission`/`RolePermission` (ver sección "Riesgos de compatibilidad").

---

## Comparación entre el schema anterior y el nuevo

| Elemento | Antes | Ahora |
|---|---|---|
| `User` | Sin cambios | Sin cambios |
| `Role` | Relación `rolePermissions RolePermission[]` | Relación reemplazada por `roleModules RoleModule[]` |
| `UserRole` | Ya implementado (pivote User↔Role) | Sin cambios |
| `Permission` | Existía como entidad de autorización granular | **Eliminada** |
| `RolePermission` | Pivote Role↔Permission | **Eliminada** |
| `Module` | No existía | **Nueva entidad** |
| `RoleModule` | No existía | **Nuevo pivote** Role↔Module |
| `Menu` | No existía | **Nueva entidad** con jerarquía recursiva (`parentId`) |
| `RefreshToken`, `TokenRevocation`, `AuditLog` | Infraestructura técnica | Sin cambios |

---

## Nuevas entidades incorporadas

### `Module`
Unidad funcional administrativa del sistema. Atributos: `id`, `nombre` (único), `descripcion`, más auditoría completa (`estado`, `fechaCreacion`, `fechaActualizacion`, `creadoPor`, `actualizadoPor`).

### `RoleModule`
Pivote que materializa la relación M:N Role↔Module. Restricción `@@unique([roleId, moduleId])` para evitar asignaciones duplicadas. Auditoría completa.

### `Menu`
Nodo de navegación jerárquico en una única tabla recursiva. Atributos: `id`, `nombre`, `url` (nulo salvo en nodos hoja), `moduleId` (FK obligatoria a `Module`), `parentId` (FK opcional a `Menu`, relación auto-referenciada `MenuHierarchy`). Auditoría completa.

---

## Entidades modificadas

### `Role`
Se retiró la relación `rolePermissions RolePermission[]` y se agregó `roleModules RoleModule[]`, reflejando que la unidad de autorización ahora se vincula a módulos en vez de permisos granulares.

---

## Relaciones agregadas

| Relación | Cardinalidad | Mecanismo |
|---|---|---|
| Role ↔ Module | M:N | Tabla `RoleModule` |
| Module → Menu | 1:N | FK `moduleId` en `Menu` |
| Menu → Menu | 1:N recursiva | FK `parentId` en `Menu` (relación nombrada `MenuHierarchy`) |

## Relaciones eliminadas

| Relación | Cardinalidad | Motivo |
|---|---|---|
| Role ↔ Permission | M:N (vía `RolePermission`) | Fuera del modelo funcional aprobado en `02_nuevo_modelo_datos.md` |

---

## Riesgos de compatibilidad

`Permission` y `RolePermission` **no eran modelos huérfanos**: estaban integrados activamente en el flujo de autenticación (`src/modules/auth/auth.service.ts`), donde alimentaban el claim `permissions` del JWT de acceso y la verificación `requiredPermissions` en `validateToken`.

Al eliminarlos del schema, el proyecto dejaba de compilar. Se acordó con el usuario un ajuste mínimo (no un rediseño) para preservar la compilación sin modificar contratos públicos:

- `selectRole()` y `refreshToken()` en `auth.service.ts` ya no consultan `rolePermission`; ambos construyen `permissions` como arreglo vacío (`const permissions: string[] = []`).
- Se conservan intactos: las firmas de `SelectRoleResponse`, `RefreshResponse`, `ValidateTokenResponse`, el claim `permissions` en el JWT, y la lógica de `validateToken()` que compara `requiredPermissions` contra `payload.permissions`.
- `prisma/seed.ts` ya no siembra `Permission`/`RolePermission`.
- `test/auth.schemas.test.ts` no requería cambios: solo valida los schemas Zod, no las entidades Prisma.

**Efecto funcional:** hasta que se implemente la autorización basada en `RoleModule`/`Menu`, el sistema emite tokens con `permissions: []`, es decir, cualquier verificación que dependa de `requiredPermissions` no vacío en `validateToken` fallará. Esto es aceptable como estado transitorio porque el modelo de autorización real (basado en módulos) aún no está conectado a ningún endpoint — no hay consumidores actuales de `requiredPermissions` fuera de la propia función.

Se verificó `npx prisma generate`, `npx tsc --noEmit` y `npx vitest run`: todo pasa sin errores tras el cambio.

---

## Recomendaciones antes de ejecutar la primera migración

1. **No existe historial de migraciones previo** (`prisma/migrations` no fue inspeccionado formalmente en este cambio) — verificar si el proyecto ya tiene una base de datos con datos reales de `Permission`/`RolePermission` antes de correr `prisma migrate dev`, ya que esa migración generará `DROP TABLE` sobre esas tablas.
2. Si existen datos productivos en `Permission`/`RolePermission`, exportarlos/respaldarlos antes de aplicar la migración, dado que el borrado de tabla es irreversible.
3. Definir en una fase posterior cómo se popula `Module`, `RoleModule` y `Menu` (vía seed o vía UI administrativa) antes de que cualquier flujo dependa de ellos para autorización real.
4. Cuando se decida reemplazar la autorización basada en `permissions` por una basada en módulos, planificar esa migración de `auth.service.ts` como una tarea explícita y separada — el ajuste actual es solo un parche de compatibilidad, no la implementación final del modelo de autorización.
