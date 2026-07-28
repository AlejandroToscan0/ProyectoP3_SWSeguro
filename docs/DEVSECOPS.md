# DevSecOps — Pipeline, secretos y PaaS

Documentación operativa de la **Fase D** del Master Gateway.

## Flujo de ramas

```text
feature/*  →  dev  →  test  →  main
```

| Evento | Workflow | Qué hace |
|---|---|---|
| PR abierto/actualizado → `dev` o `test` | `ci-pr.yml` | Build + tests Master/Frontend/Ventas (sin deploy) |
| PR mergeado → `dev`, `test` o `main` | `notify-merges.yml` | Notificación Telegram del merge |
| PR → `main` / `test` | `validate-source-branch.yml` | Solo acepta origen `test`→`main` y `dev`→`test` |
| PR mergeado → `main` | `ci-cd-deploy.yml` | Build → Sonar Quality Gate → SAST/ML → Railway CLI |

## Pipeline de producción (`main`)

1. **Build y tests** del Master, Frontend y Ventas.
2. **SonarCloud** con Quality Gate **obligatorio** (si falla, el job falla; no hay `continue-on-error`).
3. **SAST/ML** (`scripts/sast_scan.py` + CodeBERT). Si marca vulnerable → `exit 1` y bloquea deploy.
4. **Deploy** con Railway CLI (`railway up --service … --detach`).
5. **Telegram** en inicio, éxito Sonar, resultado ML, inicio deploy, éxito o fallo global.

## Secrets y variables en GitHub

Configurar en **Settings → Secrets and variables → Actions**.

### Secrets obligatorios (deploy a `main`)

| Secret | Uso |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram |
| `TELEGRAM_CHAT_ID` | Chat o grupo destino |
| `SONAR_TOKEN` | Token de SonarCloud |
| `SONAR_PROJECT_KEY` | Clave del proyecto en SonarCloud |
| `SONAR_ORGANIZATION` | Organización en SonarCloud |
| `RAILWAY_TOKEN` | Token de cuenta/proyecto Railway |
| `RAILWAY_SERVICE` | Nombre del servicio a desplegar |
| `APP_URL` | URL pública (solo para mensaje Telegram) |

### Secret opcional

| Secret | Uso |
|---|---|
| `TELEGRAM_API_URL` | Si existe, se usa en lugar de `https://api.telegram.org/bot{TOKEN}/sendMessage` |

### Variables (opcional)

| Variable | Default |
|---|---|
| `ML_MODEL_NAME` | `mahdin70/CodeBERT-VulnCWE` |

## Configurar SonarCloud

1. Crear proyecto en [SonarCloud](https://sonarcloud.io) vinculado al repo.
2. Copiar organization key y project key a los secrets anteriores.
3. Generar `SONAR_TOKEN` con permisos de análisis.
4. En el Quality Gate del proyecto, exigir condiciones mínimas (bugs, vulnerabilidades, coverage si aplica).

El workflow regenera `sonar-project.properties` en CI con esos secrets. El archivo en repo es solo plantilla.

## Configurar Telegram

1. Crear bot con [@BotFather](https://t.me/BotFather) → obtener token.
2. Agregar el bot al grupo/canal y obtener `chat_id`.
3. Guardar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en GitHub Secrets.

## Deploy con Railway CLI

El pipeline usa:

```bash
npm install -g @railway/cli
railway up --service "$RAILWAY_SERVICE" --detach
```

con `RAILWAY_TOKEN` en el entorno.

### Secrets de runtime en Railway (Master)

Configurar en el panel de Railway (no en el repo):

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_TEMP_SECRET`
- `INTERNAL_API_KEY`
- `JWT_ISSUER`, `JWT_AUDIENCE`
- TTLs de tokens
- `SEED_*` solo si se ejecuta seed en ese entorno

### Microservicio Ventas (si se despliega aparte)

- `MASTER_BASE_URL` → URL pública del Master
- `INTERNAL_API_KEY` → **mismo valor** que en el Master
- `PORT`

### Verificación manual CLI (local)

```bash
npm install -g @railway/cli
railway login
railway link
railway up --service <nombre-servicio>
```

## Cold start / sleep en PaaS free tier

En planes gratuitos (Railway/Render), el proceso puede dormirse tras inactividad.

**Comportamiento esperado:**

- La primera petición tras sleep puede fallar o tardar varios segundos.
- El microservicio Ventas **reintenta** llamadas a `POST /api/internals/validate-token` con backoff (hasta 4 intentos).
- Si el Master sigue caído, responde `503 MASTER_UNAVAILABLE` pidiendo reintento.

**Recomendación para la demo:**

1. Hacer un `GET /health` al Master unos segundos antes de la demo.
2. Si un hijo falla la primera vez, reintentar 1–2 veces.
3. Documentar en la defensa oral que el cold start es limitación del free tier, no del diseño Zero Trust.

## Checklist de demo DevSecOps

- [ ] Secrets configurados en GitHub Actions
- [ ] Merge `feature` → `dev` notifica Telegram
- [ ] Merge `dev` → `test` notifica Telegram
- [ ] CI de PR (`ci-pr.yml`) pasa en `dev`/`test`
- [ ] Merge `test` → `main` dispara pipeline completo
- [ ] Sonar Quality Gate bloquea si falla
- [ ] SAST/ML bloquea si detecta hallazgos
- [ ] Railway deploy solo tras gates verdes
- [ ] Telegram de éxito/fallo recibido
- [ ] `APP_URL` responde health tras deploy
