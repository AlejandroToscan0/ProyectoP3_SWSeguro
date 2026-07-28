# Matriz de cumplimiento — Fase E

Cierre de congruencia entre `PROJECT_CONTEXT.md` / enunciado PDF y el código del repositorio.

**Leyenda:** ✅ Cumple · ⚠️ Parcial / proceso · ❌ No aplica / no implementado (opcional)

Última verificación: 2026-07-28

---

## 1. Autenticación y JWT

| Requisito | Estado | Evidencia |
|---|---|---|
| Login con hash seguro (Argon2) | ✅ | `src/modules/auth/auth.service.ts` |
| TempToken + lista de roles activos | ✅ | `POST /api/auth/login` |
| Select-role obligatorio | ✅ | `POST /api/auth/select-role` + SPA `SelectRolePage` |
| AccessToken solo con rol seleccionado + permisos | ✅ | Claims en `issueSession` |
| Refresh rotativo | ✅ | `refresh-token` + `reemplazadoPor` |
| Logout + revocación | ✅ | `TokenRevocation` + refresh revocado |
| Validate interno Zero Trust | ✅ | `POST /api/internals/validate-token` → `{ active, userId, roleId, roleName, permissions }` |
| JWT asimétrico RS256/ES256 | ⚠️ | Opcional; se usa HS256 + validate-token (aceptable por §7) |

## 2. Modelo de datos y CRUD

| Requisito | Estado | Evidencia |
|---|---|---|
| User / Role / Module / Menu soft delete | ✅ | `estado INACTIVO` en DELETE |
| UserRole / RoleModule / RoleMenu / RolePermission | ✅ | Prisma + endpoints de asignación |
| Permission | ✅ | Seed + asignación a roles |
| RefreshToken + TokenRevocation | ✅ | Schema + auth service |
| AuditLog acciones críticas | ✅ | Login, rol, refresh, logout, revocación, user create, permissions changed |
| Campos auditoría en entidades | ✅ | `creadoPor`, `actualizadoPor`, fechas |
| Menu Adjacency List (`orden`, `icono`, `parentId`) | ✅ | `prisma/schema.prisma` |

## 3. Endpoints mínimos

| Endpoint | Estado |
|---|---|
| `POST /api/auth/login` | ✅ |
| `POST /api/auth/select-role` | ✅ |
| `POST /api/auth/refresh-token` | ✅ |
| `POST /api/auth/logout` | ✅ |
| `POST /api/internals/validate-token` | ✅ |
| CRUD `/api/users` | ✅ |
| CRUD `/api/roles` + assign users/modules/menus/permissions | ✅ |
| CRUD `/api/modules` + `GET /{id}` | ✅ |
| `GET /api/menus/tree` + CRUD menus | ✅ |

## 4. Menú dinámico

| Requisito | Estado | Evidencia |
|---|---|---|
| CTE `WITH RECURSIVE` | ✅ | `menus.service.ts` `getTreeForRole` |
| Filtrar inactivos / por rol JWT | ✅ | RoleMenu + Module ACTIVO |
| Anticiclos | ✅ | `wouldCreateCycle` |
| Solo hojas con URL | ✅ | `assertLeafUrlRules` |

## 5. Seguridad

| Requisito | Estado | Evidencia |
|---|---|---|
| Argon2, sin passwordHash en JSON | ✅ | |
| Helmet | ✅ | `src/app.ts` |
| Rate limit login/refresh/validate | ✅ | auth + internals routes |
| Zod / validación DTOs | ✅ | `*.schemas.ts` |
| Anti mass-assignment de `estado` | ✅ | updates no aceptan estado público |
| Secretos en `.env` / `.env.example` | ✅ | |
| Mensajes login genéricos | ✅ | |

## 6. Frontend SPA

| Requisito | Estado | Evidencia |
|---|---|---|
| Login | ✅ | `LoginPage` |
| Selector de rol obligatorio | ✅ | guards + `SelectRolePage` |
| Tokens en sessionStorage | ✅ | `tokenStorage.ts` |
| Bearer + refresh interceptor | ✅ | `api/client.ts` |
| Logout | ✅ | AuthContext |
| Rutas protegidas | ✅ | `routes/guards.tsx` |
| Menú dinámico desde tree | ✅ | `DynamicMenu` |
| 403 / sesión / token expirado | ✅ | `StatusPages` + navegación |
| Admin users/roles/modules/menus | ✅ | pages en `frontend/src/pages` |
| No decisión final de auth en UI | ✅ | Backend valida permisos |

## 7. Microservicio Ventas

| Requisito | Estado | Evidencia |
|---|---|---|
| Sin DB de usuarios | ✅ | `salesStore` in-memory |
| Validar vía Master | ✅ | `zeroTrust.ts` |
| Permisos `VENTAS_READ` / `VENTAS_CREATE` | ✅ | routes + seed |
| 403 sin permiso | ✅ | |
| Retries ante cold start PaaS | ✅ | backoff + `503 MASTER_UNAVAILABLE` |

## 8. CI/CD DevSecOps

| Requisito | Estado | Evidencia |
|---|---|---|
| Ramas `feature → dev → test → main` | ✅ | `validate-source-branch.yml` |
| Build + tests en PR | ✅ | `ci-pr.yml` |
| SonarCloud + Quality Gate wait | ✅ | `sonar.qualitygate.wait=true` |
| SAST/ML bloqueante | ✅ | `scripts/sast_scan.py` |
| Deploy solo si gates OK | ✅ | `ci-cd-deploy.yml` |
| Telegram: inicio, tests, Sonar, ML, deploy, fallo | ✅ | steps en workflow |
| Telegram merges `dev`/`test`/`main` | ✅ | `notify-merges.yml` |
| Railway CLI | ✅ | `railway up` |
| Protección real en GitHub (status check) | ⚠️ | Requiere configurar Branch protection / Rulesets en GitHub UI |
| Secrets de producción en PaaS | ⚠️ | Operativo: configurar en Railway (no van al repo) |

## 9. Pruebas

| Requisito | Estado | Evidencia |
|---|---|---|
| Unit tests Vitest | ✅ | `test/` (18+) |
| Smoke E2E script | ✅ | `npm run smoke` |
| Smoke ejecutado en esta máquina | ⚠️ | Requiere Docker/Postgres + servidor levantado |

---

## Decisiones aceptadas (no bloquean el 100% funcional)

1. **HS256 + validate-token** en lugar de RS256: el enunciado permite ambas vías (§7).
2. **Algunas rutas admin en SPA** (`/app/usuarios`, etc.) coexisten con páginas dinámicas: el menú sigue viniendo del backend; las rutas son mapeo de UI, no autorización.
3. **Listados por defecto ACTIVO** en lugar de filtro global Prisma: cumple soft-delete y trazabilidad; `GET by id` puede devolver inactivos para administración.

---

## Checklist de demo (E2E local)

```bash
# 1. Infra
cp .env.example .env
# Ajusta secretos ≥32 chars
npm install
npm --prefix frontend install
npm --prefix services/ventas install
npm run db:up
npm run prisma:generate
npm run db:reset

# 2. Servicios (3 terminales)
npm run dev
cp services/ventas/.env.example services/ventas/.env   # INTERNAL_API_KEY igual al Master
npm run ventas:dev
npm run frontend:dev

# 3. Smoke API
INTERNAL_API_KEY=<mismo_valor> npm run smoke

# 4. SPA http://localhost:5173
# - Login admin@example.com / ChangeMe123!
# - Seleccionar rol ADMIN
# - Abrir Ventas, listar/crear
# - Probar logout
```

### Demo pipeline (cuando secrets estén listos)

1. PR `feature/*` → `dev` → Telegram merge + CI PR
2. PR `dev` → `test` → Telegram + policy check
3. PR `test` → `main` → pipeline completo + Railway + Telegram

---

## Score final

| Área | Cumplimiento |
|---|---|
| Backend Master | ✅ |
| Frontend SPA | ✅ |
| Microservicio Ventas | ✅ |
| DevSecOps (código/workflows) | ✅ |
| Config operativa GitHub/Railway | ⚠️ (manual del equipo) |
| JWT asimétrico | ⚠️ (opcional, no bloqueante) |

**Veredicto:** el código cubre los requisitos obligatorios del contexto/PDF. Lo pendiente es configuración externa (secrets, branch protection, Docker para demo en vivo) y el opcional RS256.
