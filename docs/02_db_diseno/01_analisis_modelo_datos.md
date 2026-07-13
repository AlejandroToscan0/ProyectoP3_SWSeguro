# Análisis del Modelo de Datos — Master Gateway (Auth/AuthZ)

**Fuente original:** `docs/PROY_PARCIAL_III_DesSeguro_202650 (3).pdf`.
**Estado:** Análisis cerrado. Todas las ambigüedades detectadas en la revisión inicial fueron resueltas mediante decisiones oficiales de arquitectura (ver sección siguiente). Este documento ya no contiene alternativas abiertas ni preguntas pendientes.

---

## Decisiones oficiales de arquitectura (definitivas)

| # | Decisión |
|---|---|
| 1 | Usuario↔Rol es M:N vía `UserRole` (auditoría completa). Rol↔Módulo es M:N vía `RoleModule` (auditoría completa). Módulo→Menú es 1:N obligatoria. Menú→Menú es recursiva 1:N vía `parent_id`. **No existe `RoleMenu`**: la autorización de menús se resuelve únicamente a través de los módulos asignados al rol. |
| 2 | `Permission` y `RolePermission` quedan **fuera del modelo de datos oficial**. Si existen en la implementación actual, se documentan solo como infraestructura heredada, no como parte del modelo funcional. |
| 3 | `AuditLog` se mantiene, pero como **entidad de infraestructura técnica**, no como parte del modelo funcional descrito en el documento fuente. |
| 4 | `RefreshToken` se persiste en **PostgreSQL vía Prisma**. Redis queda descartado. |
| 5 | Cada entidad lleva únicamente sus atributos mínimos necesarios, respaldados por el documento fuente; lo indispensable no documentado se marca como "Suposición técnica mínima". |
| 6 | Auditoría completa (`estado`, `fechaCreacion`, `fechaActualizacion`, `creadoPor`, `actualizadoPor`) obligatoria en: `User`, `Role`, `Module`, `Menu`, `UserRole`, `RoleModule`. `AuditLog` y `RefreshToken` llevan solo los campos propios de su función. |
| 7 | Modelo conceptual único y oficial: `User ↔ UserRole ↔ Role ↔ RoleModule ↔ Module → Menu → Menu (parent_id)`. |
| 8 | Modelo conceptual **aprobado**, sin decisiones pendientes. |

---

## Modelo funcional — Entidades

| Entidad | Rol en el modelo | Atributos propios (mínimos) | Auditoría completa |
|---|---|---|---|
| `User` | Identidad autenticable | `id`, credencial de login (email/username — **suposición técnica mínima**: el documento no nombra el campo exacto, solo "credenciales"), `passwordHash` | Sí |
| `Role` | Unidad de autorización | `id`, `nombre`, `descripcion` | Sí |
| `UserRole` | Pivote M:N Usuario↔Rol | `id` (**suposición técnica mínima**), `usuarioId`, `rolId` | Sí (exigido explícitamente por el documento fuente) |
| `Module` | Unidad funcional administrativa (ej. Ventas, RRHH) | `id`, `nombre` | Sí |
| `RoleModule` | Pivote M:N Rol↔Módulo | `id` (**suposición técnica mínima**), `rolId`, `moduloId` | Sí |
| `Menu` | Nodo de navegación recursivo (Módulo/Submenú/Item) | `id`, `nombre`, `url` (nulo salvo en nodos hoja), `moduloId` (FK obligatoria), `parentId` (nulo si es raíz) | Sí |

**Regla de integridad:** `Menu.parentId` no debe generar referencias cíclicas (validación de aplicación, no un atributo).

**Autorización de menús:** un rol ve un nodo de `Menu` si y solo si tiene asignado (vía `RoleModule`) el `Module` al que pertenece ese nodo. No existe asignación de menú a nivel de rol independiente del módulo.

---

## Entidades de infraestructura (fuera del modelo funcional)

| Entidad | Estado | Atributos propios |
|---|---|---|
| `AuditLog` | Infraestructura técnica (no funcional) | Los propios de su función: acción, entidad/usuario/rol relacionado, detalle, metadatos de origen (IP, user agent), timestamp del evento. No lleva el set de auditoría estándar de las entidades funcionales — es en sí mismo el mecanismo de auditoría de eventos. |
| `RefreshToken` | Infraestructura técnica, persistida en PostgreSQL vía Prisma (Decisión 4) | Los necesarios para su función: identificador, referencia a `User` y `Role`, hash del token, expiración, estado de revocación, referencia al token que lo reemplazó. |
| `Permission` / `RolePermission` | Infraestructura heredada de la implementación actual; **no forman parte del modelo de datos oficial** (Decisión 2) | No se documentan atributos porque quedan fuera de alcance. |

---

## Relaciones definitivas

```
User  ↓ M:N ↓  Role       (vía UserRole, auditoría completa)
Role  ↓ M:N ↓  Module     (vía RoleModule, auditoría completa)
Module  ↓ 1:N ↓  Menu     (FK moduloId obligatoria en Menu)
Menu  ↓ 1:N ↓  Menu       (recursiva, vía parentId)
```

- **User↔Role (M:N):** un usuario puede operar bajo varios roles; un rol se asigna a varios usuarios. Se materializa en `UserRole`.
- **Role↔Module (M:N):** un rol puede tener acceso a varios módulos; un módulo puede estar asignado a varios roles. Se materializa en `RoleModule`.
- **Module→Menu (1:N):** cada nodo de `Menu` pertenece obligatoriamente a un único módulo.
- **Menu→Menu (1:N recursiva):** un nodo padre puede tener múltiples hijos; un nodo tiene a lo sumo un padre (patrón Adjacency List).
- **Sin `RoleMenu`:** la visibilidad de cualquier nodo de `Menu` depende exclusivamente de si el rol tiene asignado, vía `RoleModule`, el módulo dueño de ese nodo.

Relaciones de infraestructura (no forman parte del modelo conceptual funcional, pero existen en el esquema):
- `User 1:N RefreshToken`, `Role 1:N RefreshToken` (el token de acceso/refresco queda ligado al rol seleccionado).
- `User 0:N AuditLog`, `Role 0:N AuditLog` (referencias opcionales para trazabilidad de eventos).

---

## Comparación con la implementación actual (`prisma/schema.prisma`)

| Entidad | Existe | Acción requerida |
|---|---|---|
| `User` | Sí | Sin cambios estructurales. |
| `Role` | Sí | Sin cambios estructurales. |
| `UserRole` | Sí | Sin cambios; ya cumple auditoría completa. |
| `Module` | No | Crear. |
| `Menu` | No | Crear. |
| `RoleModule` | No | Crear. |
| `RoleMenu` | No aplica | No se crea (Decisión 1). |
| `Permission` / `RolePermission` | Sí | Retirar del modelo funcional; conservar solo si se documenta como infraestructura heredada fuera de alcance. |
| `AuditLog` | Sí | Conservar como infraestructura técnica. |
| `RefreshToken` | Sí | Conservar en PostgreSQL/Prisma (Decisión 4); sin migración a Redis. |
| `TokenRevocation` | Sí | Infraestructura auxiliar de `RefreshToken`; no forma parte del modelo funcional, se mantiene como soporte técnico de revocación. |

---

## Conclusión

Todas las decisiones de arquitectura están tomadas y no quedan alternativas, ambigüedades ni preguntas abiertas. El orden de implementación en `schema.prisma` es: `Module` → `Menu` → `RoleModule`.

**El modelo de datos se considera aprobado y listo para iniciar la implementación del archivo schema.prisma.**
