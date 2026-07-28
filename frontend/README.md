# Frontend — Master Gateway

SPA de autenticación y navegación dinámica para el Master Gateway.

## Arranque

Con el backend en `http://localhost:3000`:

```bash
cp .env.example .env
npm install
npm run dev
```

Desde la raíz del monorepo:

```bash
npm run frontend:dev
```

Abre `http://localhost:5173`.

## Flujo

1. Login (`/login`)
2. Selección obligatoria de rol (`/select-role`)
3. Workspace (`/app`) con menú desde `GET /api/menus/tree`
4. Logout

## Seguridad en cliente

- Tokens en `sessionStorage` (no `localStorage`)
- Interceptor Bearer + renovación automática con refresh token
- El frontend no autoriza de forma definitiva; solo refleja permisos/menú del backend
