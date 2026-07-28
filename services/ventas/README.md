# Microservicio Ventas (hijo)

Servicio de negocio que **no** gestiona usuarios. Cada petición valida el AccessToken contra el Master Gateway.

## Flujo Zero Trust

1. Frontend envía `Authorization: Bearer <accessToken>`
2. Ventas llama `POST /api/internals/validate-token` en el Master
3. Master valida firma, expiración, revocación y permisos
4. Si falta permiso → `403`
5. Si es válido → Ventas ejecuta la lógica de negocio

## Cold start (PaaS free tier)

Si el Master está dormido, Ventas reintenta `validate-token` con backoff (hasta 4 intentos).
Si sigue sin respuesta, responde `503 MASTER_UNAVAILABLE`. Antes de demos, llama a `GET /health` del Master.

## Arranque

```bash
cp .env.example .env
# INTERNAL_API_KEY debe coincidir con el Master
npm install
npm run dev
```

Puerto por defecto: `3001`

## Endpoints

- `GET /health`
- `GET /api/ventas` → requiere `VENTAS_READ`
- `POST /api/ventas` → requiere `VENTAS_CREATE`

### Ejemplo

```bash
curl http://localhost:3001/api/ventas \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

curl -X POST http://localhost:3001/api/ventas \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"producto":"Laptop","monto":1200}'
```
