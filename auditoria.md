# Auditoría de Avance — Master Gateway (vs. Proyecto Integrador Parcial III)

Leyenda: ✅ implementado &nbsp;|&nbsp; ⚠️ parcial &nbsp;|&nbsp; ❌ no implementado

## 1. Modelo de Datos

| Requisito | Estado | Evidencia / Nota |
|---|---|---|
| Usuarios ↔ Roles (M:N con tabla pivote) | ✅ | `prisma/schema.prisma` modelo `UserRole` |
| Roles ↔ Módulos (M:N) | ✅ | modelo `RoleModule` |
| Menú único con Adjacency List (`parent_id`, `url` solo en hojas) | ✅ | modelo `Menu` + `assertLeafUrlRules` en `menus.service.ts` |
| Campos de auditoría en tabla pivote (fecha_creacion, estado, etc.) | ✅ | `UserRole` incluye `estado`, `fechaCreacion`, `creadoPor`, etc. |
| Campos de auditoría (id, estado, fechas, creado/actualizado_por) en TODAS las entidades | ✅ | presentes en todos los modelos del schema |
| Soft delete real (nunca DELETE físico) | ✅ | todos los `.delete()` reemplazados por `update({estado: INACTIVO})` |
| Hooks de ORM que **fuercen** auditoría/soft-delete automáticamente | ❌ | no hay `$use`/`$extends` de Prisma; cada service lo hace "a mano" — funciona hoy pero es fácil de olvidar en un endpoint nuevo |

## 2. Endpoints de Autenticación

| Endpoint | Estado | Nota |
|---|---|---|
| `POST /api/auth/login` (TempToken + roles, error genérico) | ✅ | no distingue "usuario no existe" de "password incorrecta" |
| `POST /api/auth/select-role` (JWT con permisos solo del rol = least privilege) | ✅ | filtra permisos únicamente del rol elegido |
| `POST /api/auth/refresh-token` (con detección de robo/reuso) | ✅ | reuso detectado revoca **todos** los refresh tokens del usuario |
| `POST /api/auth/logout` | ✅ | revoca refresh token + jti |
| `POST /api/internals/validate-token` | ✅ | protegido con `x-internal-api-key` |

## 3. CRUD y Endpoints de Negocio

| Recurso | Estado |
|---|---|
| Usuarios (`/api/users`) | ✅ |
| Roles + asignar/desasignar usuario (M:N) | ✅ |
| Módulos (`/api/modules`) + asignar módulo a rol | ✅ |
| Menús (`/api/menus`) + asignar menú a rol | ✅ |
| `GET /api/menus/tree` con **CTE recursiva real** (`WITH RECURSIVE` vía `$queryRaw`, sin N+1) | ✅ |
| Validación anti-ciclos en `parent_id` al actualizar menú | ✅ | `wouldCreateCycle` con set de visitados |

## 4. Seguridad No Funcional (Zero Trust / Shift-Left)

| Requisito | Estado | Nota |
|---|---|---|
| JWT obligatorio en cada endpoint (sin rutas públicas post-login) | ✅ | único público es `/health` |
| Rate limiting en login | ✅ | 10 req/min |
| Hash de contraseñas con Argon2 (uso real, no solo dependencia) | ✅ | usado en login, refresh y verify |
| Gestión de secretos (sin hardcodeo, validados por Zod ≥32 chars) | ✅ | `.env` ignorado en git, `env.ts` valida y falla el arranque si faltan |
| Microservicio hijo (Ventas) sin BD propia de usuarios | ✅ | sin Prisma/BD, storage en memoria |
| Ventas valida contra el Master (`/api/internals/validate-token`), no confía en el frontend | ✅ | con reintentos ante Master "dormido" |
| SAST avanzado (modelo ML real, no placeholder) | ✅ | `scripts/sast_scan.py` usa CodeBERT-VulnCWE de HuggingFace |
| Tests de seguridad/unitarios | ⚠️ | solo cubren `auth`, `menus`, `roles` — faltan `users`, `modules`, `permissions`, `internals` |

## 5. Frontend (SPA)

| Requisito | Estado | Nota |
|---|---|---|
| Pantalla de selección de rol obligatoria (bloquea dashboard directo) | ✅ | `guards.tsx` fuerza `/select-role` antes de `/app` |
| Menú de navegación construido dinámicamente desde `/api/menus/tree` | ✅ | `DynamicMenu.tsx` |
| **Rutas** del router construidas 100% desde el JSON del menú (sin hardcodear) | ⚠️ | `App.tsx` define rutas fijas (`usuarios`, `roles`, `modulos`, `menus`, `ventas`); solo el `*` cae a un `DynamicModulePage` genérico. Es un híbrido, no cumple el requisito estricto de "cero hardcodeo" |

## 6. Infraestructura, CI/CD y DevSecOps (Anexo)

| Requisito | Estado | Nota |
|---|---|---|
| Estrategia de ramas `main`/`test`/`dev` con PR obligatorio | ✅ | `validate-source-branch.yml` fuerza `test→main` y `dev→test` |
| Pipeline build + tests | ✅ | `ci-pr.yml`, `ci-cd-deploy.yml` |
| SonarCloud con Quality Gate obligatorio | ✅ | `ci-cd-deploy.yml`, `sonar.qualitygate.wait=true` |
| SAST avanzado (ML) integrado en el pipeline de `main` | ✅ | paso "Análisis SAST avanzado" en `ci-cd-deploy.yml` |
| Deploy automático vía CLI (no solo webhook) a Railway/Render | ✅ | `railway up --detach` en `ci-cd-deploy.yml` |
| Secrets gestionados vía GitHub Secrets (no hardcodeados) | ✅ | todos los tokens/credenciales vienen de `secrets.*` |
| Notificaciones Telegram: inicio pipeline, Quality Gate, alertas SAST, deploy | ✅ | pasos dedicados en `ci-cd-deploy.yml` |
| Notificaciones Telegram: merges a `dev`/`test`/`main` | ✅ | `notify-merges.yml` |
| **Bug reciente:** build fallaba en CI por falta de `prisma generate` antes de `tsc` | ✅ *(recién corregido)* | agregado paso "Generar cliente Prisma" en `ci-pr.yml` y `ci-cd-deploy.yml` |
| Creación automática de PRs `dev→test` y `test→main` (mejora solicitada, no exigida por el PDF) | ✅ *(recién agregado)* | `auto-pr-dev-to-test.yml`, `auto-pr-test-to-main.yml` — **pendiente activar permiso "Allow GitHub Actions to create and approve pull requests" en Settings del repo** |

---

## Resumen de Pendientes

1. **Hooks de auditoría automáticos en Prisma** — hoy cada `service.ts` setea `creadoPor`/`actualizadoPor`/soft-delete manualmente; formalizarlo con `prisma.$extends` evitaría errores humanos en módulos futuros.
2. **Rutas del frontend 100% dinámicas** — actualmente son fijas por módulo conocido + un fallback genérico; falta que el router derive componentes reales desde el árbol de menú del backend.
3. **Cobertura de tests** — faltan tests unitarios para `users`, `modules`, `permissions` e `internals`.
4. **Activar en GitHub** el permiso de Actions para que los nuevos workflows de auto-creación de PR funcionen (requiere acceso admin del repo).

## En Buen Estado

El núcleo de seguridad del proyecto (Zero Trust, least privilege, Argon2, CTE recursiva real, soft delete, SAST con modelo ML real, pipeline con Quality Gate obligatorio y estrategia de ramas protegida) está **completo y correctamente implementado**, cubriendo la mayoría de los objetivos específicos (OE1–OE5) del documento.
