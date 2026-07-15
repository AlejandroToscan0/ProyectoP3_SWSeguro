# Plan de adaptación del módulo Auth al nuevo modelo RBAC

Auditoría del módulo `auth` frente al modelo físico vigente (`User → UserRole → Role → RoleModule → Module → Menu`). Documento de planificación — **no se modificó ningún archivo de código** en esta fase.

---

## 0. Nota sobre la estructura real del módulo

El encargo pedía auditar `auth.controller.ts`, `auth.repository.ts` y `auth.types.ts`. Esos archivos **no existen** en el proyecto; la arquitectura actual es más plana:

| Archivo esperado | Archivo real / equivalente |
|---|---|
| `auth.controller.ts` | No existe. Las rutas (`auth.routes.ts`) llaman directo a `AuthService`, sin capa de controller intermedia. |
| `auth.repository.ts` | No existe. `AuthService` recibe `PrismaClient` inyectado por constructor y hace las queries Prisma directamente (sin capa repository). |
| `auth.types.ts` | No existe. Los tipos de respuesta (`LoginResponse`, `SelectRoleResponse`, etc.) están definidos inline al inicio de `auth.service.ts`. |
| Middleware de autenticación | No existe un middleware Express de `requireAuth`/`requirePermissions` dentro de este proyecto. El patrón es de **gateway**: este servicio expone `/api/internals/validate-token` (protegido por `x-internal-api-key`) para que *otros* microservicios verifiquen tokens; no hay rutas propias protegidas aquí. |

Esto no es un hallazgo que requiera corrección — es el estado real del código, y el plan de abajo respeta esta estructura (no se propone introducir capas nuevas, ver sección "Cambios opcionales").

---

## Resumen ejecutivo

El modelo de datos ya migró a `RoleModule`/`Module`, pero **`auth.service.ts` quedó en un estado transitorio**: la fase anterior (eliminación de `Permission`/`RolePermission`) dejó el arreglo `permissions` hardcodeado en `[]` para que el proyecto compilara, sin conectarlo todavía al nuevo modelo. Esto tiene una consecuencia funcional activa, no solo estética: `validateToken()` compara `requiredPermissions` contra un arreglo siempre vacío, por lo que **cualquier llamada a `/api/internals/validate-token` con `requiredPermissions` no vacío falla siempre con 403**, aunque el rol tenga módulos asignados. El smoke test actual no lo detecta porque nunca envía `requiredPermissions`.

El objetivo de esta fase es cerrar ese hueco: reemplazar la fuente de la lista de "capacidades" del rol, que hoy es un placeholder vacío, por una consulta real a `RoleModule → Module`. No se toca el CRUD de `Module`/`Menu` (no existe todavía, y no se pide crearlo), ni se cambian rutas, ni contratos HTTP salvo lo estrictamente necesario.

Hay una decisión de diseño que no puedo resolver por mi cuenta y que condiciona el resto del plan: **qué forma toma el reemplazo de `permissions` en el JWT y en las respuestas** (ver "Dependencias" y "Riesgos").

---

## Archivos afectados

| Archivo | Rol en el cambio |
|---|---|
| `src/modules/auth/auth.service.ts` | Cambio obligatorio principal: `selectRole()`, `refreshToken()`, `verifyAccessToken()`, `validateToken()`, `issueSession()`. |
| `src/modules/auth/auth.schemas.ts` | Cambio obligatorio menor: campo `requiredPermissions` en `validateTokenSchema` (ver decisión de nombre). |
| `prisma/seed.ts` | Cambio obligatorio: hoy no siembra ningún `Module`/`RoleModule`, así que tras el cambio el admin seed tendría 0 módulos asignados y el JWT quedaría vacío igual. Hace falta sembrar al menos un `Module` y su `RoleModule` con el rol `ADMIN`. |
| `src/modules/auth/auth.routes.ts` | Sin cambios de lógica. Revisar solo si cambia el nombre del campo en la respuesta JSON (pass-through directo, no transforma nada). |
| `src/modules/internals/internals.routes.ts` | Sin cambios de lógica; mismo caso que arriba. |
| `test/auth.schemas.test.ts` | Cambio obligatorio menor si se renombra `requiredPermissions`. |
| `scripts/smoke-test.mjs` | Cambio opcional recomendado: agregar una aserción de `requiredPermissions`/módulos para cubrir el hueco que hoy pasa silenciosamente. |
| `README.md` | Cambio obligatorio de documentación: el ejemplo de `curl` en la línea 244 usa `requiredPermissions: ["AUTH_LOGIN"]`, un código de permiso que ya no existe en ningún lado. |
| `docs/02_db_diseno/03_schema_actualizado.md` | Ya deja constancia del estado transitorio; se actualiza al cerrar esta fase (fuera del alcance de este documento, pero se referencia). |

---

## Cambios obligatorios

### 1. `selectRole()` — reemplazar el placeholder por una consulta real a `RoleModule`

Hoy (línea 152-169 de `auth.service.ts`): el `include` trae solo `role: true` y `permissions` se fija en `[]`.

Debe pasar a incluir los módulos activos del rol:

```
include: {
  role: {
    include: {
      roleModules: {
        where: { estado: Estado.ACTIVO, module: { estado: Estado.ACTIVO } },
        include: { module: true },
      },
    },
  },
}
```

y derivar la lista a partir de `userRole.role.roleModules.map(rm => rm.module.nombre)` (o `.id`, ver decisión de diseño abajo).

**Por qué debe cambiar:** es el reemplazo funcional directo de lo que antes hacía `rolePermissions` — sin esto, el JWT nunca refleja el modelo de autorización real y el sistema queda permanentemente en modo "sin permisos".

### 2. `refreshToken()` — misma consulta, misma razón

Hoy (línea 232, antes 242-250 en la versión previa a la limpieza de `Permission`): mismo placeholder `[]`. Debe repetir la consulta a `roleModule` con `stored.roleId` al momento de rotar el token, igual que hacía antes con `rolePermission`. Esto preserva la propiedad de seguridad original: los permisos/módulos se re-derivan en cada rotación, no se copian del token viejo, así que una revocación de acceso a un módulo se refleja en el siguiente refresh sin esperar a un nuevo login.

### 3. `issueSession()` / claim JWT — decidir nombre y contenido

`issueSession()` firma el JWT con `permissions` (línea 448, 455). Con datos reales de `Module`, hay que decidir si:
- (a) se mantiene el nombre de claim `permissions` pero ahora contiene nombres/ids de `Module` (mínimo cambio de contrato, pero el nombre pasa a ser semánticamente incorrecto), o
- (b) se renombra el claim a `modules` (contrato más honesto, pero rompe cualquier consumidor externo que ya lea `permissions` de tokens emitidos hoy).

Esta decisión se necesita **antes** de tocar código — ver "Dependencias".

### 4. `verifyAccessToken()` — ajustar la validación de forma del payload

Línea 393-408: valida `Array.isArray(payload.permissions)` y filtra que todos los elementos sean `string`. Si se renombra el claim (opción b), este bloque debe validar el nuevo nombre de campo. Si se mantiene el nombre (opción a), no requiere cambios aquí.

### 5. `validateToken()` — decidir semántica de `requiredPermissions`

Línea 335-344: hoy filtra `requiredPermissions` contra `payload.permissions`. Con el modelo nuevo, la pregunta de negocio pasa de "¿tiene este permiso granular?" a "¿tiene acceso a este módulo?". Debe mantenerse el mecanismo de rechazo (403 `INSUFFICIENT_PERMISSIONS` si falta algo), pero el significado de los strings comparados cambia de código de permiso (`AUTH_LOGIN`) a nombre/id de módulo (`AUTH`, `VENTAS`, etc.). Si se opta por renombrar el claim (punto 3b), este campo también debería renombrarse a `requiredModules` en `auth.schemas.ts` y en el body que reciben los microservicios consumidores.

### 6. `prisma/seed.ts` — sembrar `Module` y `RoleModule`

Sin esto, el admin sembrado queda con 0 módulos tras el cambio y el smoke test no puede verificar nada realista. Es un cambio obligatorio, no opcional, porque de lo contrario no hay forma de probar el punto 1 y 2 end-to-end.

### 7. `README.md` — corregir el ejemplo con `AUTH_LOGIN`

Documentación desactualizada que induce a error a cualquiera que copie el ejemplo tal cual.

---

## Cambios opcionales (deuda técnica, separada de lo obligatorio)

- **Introducir una capa repository o controller**: no se pide y no es necesario para esta fase; el patrón actual (rutas → service con Prisma inyectado) funciona y no se toca.
- **Cachear la consulta de `RoleModule`** para evitar dos roundtrips a la BD en cada `refreshToken()` (uno para `refreshToken`, otro para `roleModule`) — optimización, no corrección funcional. No abordar ahora.
- **Extender `smoke-test.mjs`** con una aserción explícita de `requiredPermissions`/`requiredModules` fallido y exitoso, para que el hueco que hoy pasa silenciosamente quede cubierto por CI. Recomendado pero no bloqueante para esta fase.
- **Endpoint para listar módulos accesibles por un rol** (fuera de alcance explícito: "no implementar CRUD de Module ni Menu").
- **Invalidar/registrar en auditoría cuando un `RoleModule` se desactiva** mientras existen refresh tokens activos de ese rol — hoy el sistema ya re-deriva permisos en cada refresh (mitiga el riesgo), pero no hay un evento de auditoría específico para "acceso a módulo revocado en caliente". Deuda, no bloqueante.

---

## Riesgos

1. **Bug activo ya presente en producción/staging si el proyecto se desplegó tras la fase 1**: cualquier consumidor que envíe `requiredPermissions` no vacío a `/api/internals/validate-token` recibe 403 siempre. Esto no lo introduce esta fase — ya existe — pero es el riesgo más urgente detectado en la auditoría.
2. **Contrato público del JWT y de las respuestas HTTP**: si se renombra `permissions` → `modules`, cualquier consumidor externo (otros microservicios, Postman collections, frontend) que lea ese campo por nombre se rompe. El repo no tiene evidencia de consumidores reales del contenido de ese campo (el smoke test no lo valida), pero el README sí lo documenta como API pública — asumir que hay consumidores fuera del repo es más seguro que asumir que no los hay.
3. **Seed desincronizado con el modelo de autorización real**: si se siembra un `Module`/`RoleModule` de ejemplo, hay que mantenerlo coherente con lo que use el smoke test y cualquier colección de Postman ya validada, para no romper esas pruebas ya aprobadas.
4. **Ambigüedad `nombre` vs `id` de `Module` en el claim**: usar `nombre` es más legible para debugging y para que otros servicios comparen por string estable, pero `nombre` es mutable (no hay constraint de inmutabilidad más allá del `@@unique`); usar `id` es estable pero opaco. Afecta directamente el diseño de `requiredPermissions`/`requiredModules`.

---

## Dependencias

- **Decisión de producto/arquitectura pendiente antes de implementar** (puntos 3 y 5 de "Cambios obligatorios"): mantener el nombre `permissions` (compatibilidad) vs renombrar a `modules` (claridad). Este documento no toma esa decisión — se necesita tu confirmación explícita antes de escribir código.
- **Decisión secundaria**: comparar por `Module.nombre` o `Module.id` en el claim y en `requiredPermissions`/`requiredModules`.
- El punto 6 (seed) depende de la decisión anterior, porque el nombre del módulo sembrado debe coincidir con lo que se compare en `requiredPermissions`/`requiredModules` en cualquier prueba.
- No hay dependencias externas al repo (no se toca infraestructura, Docker, ni otros módulos fuera de `auth` e `internals`).

---

## Orden recomendado de implementación

1. Confirmar contigo la decisión de nombre de claim (`permissions` vs `modules`) y de valor comparado (`nombre` vs `id` de `Module`).
2. Actualizar `prisma/seed.ts`: sembrar un `Module` de ejemplo y su `RoleModule` con el rol `ADMIN` sembrado.
3. Actualizar `auth.service.ts`:
   - `selectRole()`: consulta real a `roleModule`.
   - `refreshToken()`: misma consulta real.
   - `issueSession()` / `verifyAccessToken()`: ajustar nombre de claim si aplica.
   - `validateToken()`: ajustar semántica y (si aplica) nombre de campo.
4. Actualizar `auth.schemas.ts` si cambia el nombre de `requiredPermissions`.
5. Actualizar `test/auth.schemas.test.ts` si cambia el nombre de campo.
6. Actualizar `README.md` (ejemplo de `curl`).
7. Re-ejecutar `npm test`, `npx tsc --noEmit`, `npm run db:reset`, `npm run smoke` para confirmar que el flujo completo (login → select-role → refresh → validate-token con y sin `requiredPermissions`/`requiredModules` → logout) funciona con datos reales de `Module`/`RoleModule`.
8. (Opcional) Extender `scripts/smoke-test.mjs` con la aserción de módulo requerido.
9. Actualizar `docs/02_db_diseno/03_schema_actualizado.md` para quitar la nota de "estado transitorio" una vez cerrado este ciclo.

---

**Este plan no ha modificado ningún archivo de código.** Queda pendiente tu aprobación y, en particular, la decisión de nombre de claim/campo antes de iniciar la implementación.
