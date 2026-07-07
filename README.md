# Master Gateway de Autenticación y Autorización

Sistema académico para centralizar autenticación, autorización por roles y validación de tokens en una arquitectura de microservicios.

## ¿Qué hace este proyecto?

Este servicio actúa como "puerta maestra" de seguridad:

- valida usuario y contraseña;
- obliga a elegir un rol después del login;
- emite tokens con permisos mínimos según el rol elegido;
- rota refresh tokens para reducir riesgo de secuestro de sesión;
- permite validación interna de tokens para microservicios hijos.

## Estado actual (Fase 1)

Implementado:

- `POST /api/auth/login`
- `POST /api/auth/select-role`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `POST /api/internals/validate-token`
- auditoría básica y revocación de tokens

Pendiente:

- CRUD completo de usuarios/roles/módulos/menús
- árbol de menús dinámico
- frontend SPA
- CI/CD completo con SonarCloud/Telegram

## Requisitos previos

Necesitas tener instalado:

- Node.js 20 o superior
- npm
- PostgreSQL 14 o superior

## Configuración inicial (paso a paso)

1. Clona el repositorio y entra a la carpeta del proyecto.
2. Crea tu archivo de entorno:

```bash
cp .env.example .env
```

3. Abre `.env` y ajusta al menos:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`
   - `JWT_TEMP_SECRET`
   - `INTERNAL_API_KEY`

> Importante: usa secretos largos y únicos. No compartas el archivo `.env`.

## Instalación y arranque

Ejecuta en orden:

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

Si todo está bien, el servicio queda escuchando en `http://localhost:3000`.

## Verificación rápida

### 1) Salud del servicio

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{"status":"ok"}
```

### 2) Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
```

Obtendrás un `tempToken` y la lista de roles.

### 3) Selección de rol

```bash
curl -X POST http://localhost:3000/api/auth/select-role \
  -H "Content-Type: application/json" \
  -d '{"tempToken":"<TEMP_TOKEN>","roleId":"<ROLE_ID>"}'
```

Obtendrás `accessToken`, `refreshToken`, rol activo y permisos.

### 4) Renovar tokens

```bash
curl -X POST http://localhost:3000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

### 5) Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"<ACCESS_TOKEN>","refreshToken":"<REFRESH_TOKEN>"}'
```

### 6) Validación interna (microservicios)

```bash
curl -X POST http://localhost:3000/api/internals/validate-token \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: <INTERNAL_API_KEY>" \
  -d '{"token":"<ACCESS_TOKEN>","requiredPermissions":["AUTH_LOGIN"]}'
```

## Pruebas automáticas

```bash
npm run build
npm run test
```

## Guía rápida para personas no técnicas

- Si ves error de base de datos, significa que PostgreSQL no está encendido o `DATABASE_URL` está mal.
- Si ves error de token, revisa que copiaste el token completo sin espacios.
- Si ves error `401`, normalmente faltan credenciales o son inválidas.
- Si ves error `403`, tus permisos o rol no alcanzan para esa acción.

## Seguridad mínima recomendada para desarrollo

- No subir `.env` al repositorio.
- Cambiar contraseñas y secretos por valores propios.
- No reutilizar tokens de pruebas en producción.
- Mantener dependencias actualizadas.
