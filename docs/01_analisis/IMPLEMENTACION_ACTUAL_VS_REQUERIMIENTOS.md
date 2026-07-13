# Auditoría Técnica: Master Gateway de Autenticación y Autorización
## Implementación Actual vs. Requerimientos Oficiales

Este documento presenta una auditoría técnica completa del estado actual del proyecto **Master Gateway de Autenticación y Autorización** en comparación con los requerimientos oficiales del proyecto integrador. El análisis abarca arquitectura, base de datos, backend, frontend, seguridad y el pipeline de DevSecOps.

---

## 1. Resumen Ejecutivo

La base del sistema Master Gateway está implementada con un nivel de calidad sobresaliente en cuanto a los flujos críticos de autenticación. Se detectó una implementación funcional y segura para el inicio de sesión (`POST /api/auth/login`), la selección explícita de rol (`POST /api/auth/select-role`), la rotación de Refresh Tokens (RTR) con detección de reuso, la invalidación de tokens en el cierre de sesión (`POST /api/auth/logout`) y la validación de tokens por microservicios (`POST /api/internals/validate-token`).

Sin embargo, el proyecto se encuentra en una **fase inicial (Fase 1)**. Las brechas principales corresponden a:
1. **Modelado incompleto en base de datos**: No existen las entidades de `Module` (Módulos) y `Menu` (Menús) requeridas para la carga jerárquica.
2. **Ausencia total de CRUDs**: No se han desarrollado las APIs de gestión para Usuarios, Roles, Módulos ni Menús.
3. **Ausencia de Frontend**: El cliente React SPA no ha sido inicializado.
4. **Infraestructura y Pipeline DevSecOps inexistentes**: Falta configurar GitHub Actions, SonarCloud, el análisis SAST avanzado con Machine Learning (CodeBERT), el despliegue automático y las notificaciones del bot de Telegram.

---

## 2. Arquitectura Actual

El backend está construido sobre **Node.js** utilizando **Express.js** en su versión 5.2.1, configurado para usar módulos nativos de ECMAScript (`"type": "module"`). 

### Organización por Capas y Patrón Arquitectónico
El proyecto sigue un patrón arquitectónico de **Capas Basadas en Dominios/Módulos** (Modular Layered Architecture). Se organiza en torno a directorios funcionales dentro de `src/modules`:

1. **Capa de Enrutamiento (`*.routes.ts`)**: Recibe peticiones HTTP, aplica limitación de tasa (rate limiting), delega la validación de los datos entrantes a esquemas de Zod y dirige el flujo al servicio correspondiente.
2. **Capa de Validación y DTOs (`*.schemas.ts`)**: Define los tipos de datos de entrada y salida, aplicando reglas estrictas de formato y longitud mediante Zod.
3. **Capa de Servicio / Lógica de Negocio (`*.service.ts`)**: Contiene la lógica transaccional, la verificación criptográfica, la firma de tokens JWT, la persistencia de logs de auditoría y la comunicación con la base de datos a través de Prisma ORM.
4. **Capa de Datos e Integración (`src/lib/prisma.ts`)**: Expone el cliente de Prisma integrado con un adaptador nativo de PostgreSQL (`@prisma/adapter-pg` y `pg`).
5. **Capa Transversal (Common/Middlewares/Config)**: Proporciona clases de error personalizadas (`HttpError`), manejadores globales de excepciones (para capturar errores de validación de Zod y errores 500) y logs estructurados con redacción de datos sensibles.

---

## 3. Tecnologías Detectadas

El stack tecnológico actual está compuesto por:

* **Backend Runtime**: Node.js (v20 o superior)
* **Framework Web**: Express.js v5.2.1 (se utiliza Express en lugar del NestJS sugerido en la especificación de tecnologías del PDF)
* **ORM**: Prisma ORM v7.8.0
* **Base de Datos**: PostgreSQL v16 (corriendo en un contenedor Docker con la imagen `postgres:16-alpine`)
* **Hashing de Contraseñas**: Argon2 v0.44.0 (cumple con las recomendaciones de OWASP y el requisito de hash lento y adaptativo; se prefiere sobre bcrypt por mayor resistencia a ataques de GPU/ASIC)
* **Firma y Validación de JWT**: Jose v6.2.3 (utilizado para procesar JSON Web Tokens con firmas simétricas HS256)
* **Validación de Esquemas**: Zod v4.4.3
* **Logging Estructurado**: Pino v10.3.1 y Pino-HTTP v11.0.0 (configurado con redacción automática para omitir contraseñas, authorization headers y tokens en consola)
* **Seguridad Express**: Helmet v8.2.0 (cabeceras de seguridad HTTP) y Cors v2.8.6
* **Limitador de Tasa**: Express-rate-limit v8.5.2
* **Entorno de Pruebas**: Vitest v4.1.10 y Supertest v7.2.2
* **Ejecutor TypeScript**: Tsx v4.23.0

---

## 4. Estructura del Proyecto

A continuación se detalla el árbol de directorios del proyecto y el propósito de cada carpeta:

```text
ProyectoP3_SWSeguro/
├── prisma/
│   ├── schema.prisma        # Definición del modelo de datos de Prisma y relaciones PostgreSQL
│   └── seed.ts              # Script para poblar la base de datos (Usuario admin, roles y permisos iniciales)
├── scripts/
│   └── smoke-test.mjs       # Script de prueba de humo que emula el flujo completo de autenticación y revocación
├── src/
│   ├── app.ts               # Inicialización y configuración de Express (middlewares globales y enrutador principal)
│   ├── server.ts            # Punto de entrada para levantar el servidor HTTP en el puerto configurado
│   ├── common/
│   │   └── http-error.ts    # Clase de error para mapear códigos de estado HTTP y mensajes de error
│   ├── config/
│   │   ├── env.ts           # Validación estricta de variables de entorno usando Zod
│   │   └── logger.ts        # Configuración del logger Pino con sanitización de datos confidenciales
│   ├── lib/
│   │   └── prisma.ts        # Inicialización del cliente Prisma utilizando el adaptador Pg
│   ├── middlewares/
│   │   └── error-handler.ts # Captura global de excepciones (ZodError, HttpError, 500) y manejo de 404
│   └── modules/
│       ├── auth/
│       │   ├── auth.routes.ts   # Definición de rutas (/login, /select-role, /refresh-token, /logout)
│       │   ├── auth.schemas.ts  # Esquemas Zod de validación de payload y DTOs para auth
│       │   └── auth.service.ts  # Servicio con la lógica de negocio de autenticación, JWT y auditoría
│       └── internals/
│           └── internals.routes.ts # Ruta privada (/validate-token) para la validación asíncrona de los microservicios hijos
├── test/
│   ├── auth.schemas.test.ts # Pruebas unitarias para validar las entradas de la API
│   └── auth.service.test.ts # Pruebas unitarias que simulan base de datos y validan las reglas de negocio
├── docker-compose.yml       # Orquestación del contenedor PostgreSQL de desarrollo
├── tsconfig.json            # Configuración del compilador TypeScript (ESNext y NodeNext)
├── package.json             # Manifiesto de dependencias de Node.js y scripts npm
└── README.md                # Documentación inicial y guía de arranque del desarrollador
```

---

## 5. Base de Datos (Modelos y Relaciones)

El archivo [schema.prisma](file:///C:/Users/PACO/Desktop/SW%20SEGURO/U3/ProyectoP3_SWSeguro/prisma/schema.prisma) define las siguientes entidades:

### Entidades Encontradas
1. **User (Usuario)**: Almacena información del usuario (`nombre`, `email` único, `passwordHash`, `estado` de tipo Enum `Estado` [ACTIVO, INACTIVO], fechas de creación y actualización, y campos de auditoría `creadoPor` y `actualizadoPor`).
2. **Role (Rol)**: Define los roles de seguridad (`nombre` único, `descripcion`, `estado` y campos de auditoría).
3. **UserRole (Relación Usuario-Rol)**: Tabla pivot intermedia que materializa la relación Many-to-Many ($M:N$) entre `User` y `Role`. Incorpora campos de auditoría propios (`fechaCreacion`, `creadoPor`, etc.) y estado, tal como lo exige el estándar de seguridad.
4. **Permission (Permiso)**: Almacena los permisos atómicos del sistema (`codigo` único, `descripcion`, `estado` y campos de auditoría).
5. **RolePermission (Relación Rol-Permiso)**: Tabla pivot intermedia para la relación Many-to-Many ($M:N$) entre `Role` y `Permission`. Incluye campos de auditoría y estado.
6. **RefreshToken**: Registra las sesiones activas por usuario y rol. Almacena el `tokenHash` (verificado con Argon2), fecha de `expiracion`, booleano `revocado`, referencia al token que lo reemplazó (`reemplazadoPor`) para control de reuso, estado y campos de auditoría.
7. **TokenRevocation (Lista Negra)**: Guarda los identificadores únicos (`jti`) de los Access Tokens revocados (por ejemplo, en el logout), con su fecha de expiración para permitir limpieza periódica.
8. **AuditLog (Bitácora de Auditoría)**: Almacena las acciones críticas (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `ROLE_SELECTED`, `TOKEN_REFRESHED`, `TOKEN_REVOKED`, `LOGOUT`, `UNAUTHORIZED_ATTEMPT`) con referencias a `User` y `Role` (opcionales), una descripción detallada (`detail`), la dirección IP (`ipAddress`) y el agente de usuario (`userAgent`).

### Faltantes Críticos en el Modelo de Base de Datos
* **Falta el modelo `Module` (Módulo)**: No existe entidad en el schema para representar unidades funcionales del sistema (ej. Ventas, RRHH).
* **Falta el modelo `Menu` (Menú)**: No existe entidad para representar la estructura jerárquica y recursiva mediante el patrón Adjacency List (`parent_id`).
* **Falta la relación `Role` - `Module`**: No existe vinculación que asocie qué roles tienen acceso a qué módulos.
* **Falta la relación `Menu` - `Module` y `Menu` - `Role`**: Falta enlazar menús con su módulo padre y asociar items del menú a roles.

---

## 6. Estado del Proyecto (Resumen de Componentes)

| Componente / Módulo | Solo Estructura | Parcial | Completo |
| :--- | :---: | :---: | :---: |
| **Módulo Auth (Backend)** | | | ✔ |
| **Módulo Internals (Backend)** | | | ✔ |
| **Módulo Users (Backend)** | | ⚠ (Solo modelo de BD y Seed) | |
| **Módulo Roles (Backend)** | | ⚠ (Solo modelo de BD y Seed) | |
| **Módulo Modules (Backend)** | ✘ (Inexistente) | | |
| **Módulo Menus (Backend)** | ✘ (Inexistente) | | |
| **Base de Datos (PostgreSQL)** | | ⚠ (Modelos parciales, sin Modules ni Menus) | |
| **Frontend React SPA** | ✘ (Inexistente) | | |
| **Estrategia DevSecOps (Actions, SAST, Sonar)** | ✘ (Inexistente) | | |

---

## 7. Comparación contra los Requerimientos Oficiales

| Requisito | Estado | Evidencia encontrada | Observaciones |
| :--- | :---: | :--- | :--- |
| **Arquitectura de Microservicios** | ⚠ Parcial | Endpoint `/api/internals/validate-token` expuesto con API Key interna. | Listo para validar tokens de otros servicios, pero no hay microservicios de negocio implementados. |
| **Modelo de datos** | ⚠ Parcial | `schema.prisma` estructurado con relaciones $M:N$ intermedias completas. | Faltan las tablas de `Module` y `Menu`. |
| **Usuarios** | ⚠ Parcial | Modelo de datos `User` y poblado inicial en `seed.ts`. | No hay endpoints ni servicios de gestión de usuarios creados. |
| **Roles** | ⚠ Parcial | Modelo de datos `Role` en schema y semilla en `seed.ts`. | Sin API para gestión. |
| **Relación Usuario-Rol** | ⚠ Parcial | Tabla intermedia `UserRole` en base de datos. | Falta implementar endpoints de asignación (`POST /api/roles/{id}/users`) y desasignación. |
| **CRUD Usuarios** | ✘ No | Ninguno. | Requerido en la sección de endpoints mínimos de la especificación. |
| **CRUD Roles** | ✘ No | Ninguno. | Requerido en la sección de endpoints mínimos de la especificación. |
| **CRUD Módulos** | ✘ No | Ninguno. | Requerido para registrar módulos del sistema (ej. Ventas, RRHH). |
| **CRUD Menús** | ✘ No | Ninguno. | Requerido para gestionar accesos dinámicos. |
| **Menú Recursivo** | ✘ No | Ninguno. | Debe implementarse mediante una única tabla con patrón Adjacency List (`parent_id`) en base de datos. |
| **JWT** | ✔ Sí | Tokens creados y verificados con la librería `jose` en `AuthService`. | Cumple con el estándar de seguridad. |
| **Selección de Rol** | ✔ Sí | Método `selectRole` expuesto en `/api/auth/select-role` que intercambia un `tempToken` por un JWT con permisos específicos. | Cumple perfectamente con el Workspace Selector para Tenant/Rol Isolation. |
| **TempToken** | ✔ Sí | Token emitido tras login exitoso (`tempToken`) firmado con `JWT_TEMP_SECRET` y TTL corto (300s). | Impide el acceso directo al dashboard sin seleccionar rol. |
| **Refresh Token** | ✔ Sí | Rotación de Refresh Tokens (RTR) con hash guardado en BD. Detección de reuso que revoca todas las sesiones activas del usuario. | Excelente práctica de seguridad robusta (Zero Trust). |
| **Logout** | ✔ Sí | Endpoint `/api/auth/logout`. Inactiva el Refresh Token y guarda el `jti` del Access Token en `TokenRevocation`. | Correctamente implementado a nivel de base de datos. |
| **Validación interna de Token** | ✔ Sí | Endpoint `/api/internals/validate-token` protegido con header `x-internal-api-key`. | Centraliza la autorización para los microservicios hijos. |
| **Soft Delete** | ⚠ Parcial | Campo `estado` de tipo Enum `Estado` [ACTIVO, INACTIVO] en los modelos. | Falta aplicar la lógica en consultas y configurar filtros automáticos (Global Scope) a nivel de ORM. |
| **Auditoría** | ⚠ Parcial | Entidad `AuditLog` y llamadas para registrar eventos de autenticación (`logAudit`). | Falta integrar la auditoría en los CRUDs de Usuarios, Roles, Módulos y Menús. |
| **Zero Trust** | ⚠ Parcial | Tokens con expiración corta, lista negra de revocación (JTI), rate limiters aplicados por ruta. | Falta implementar el middleware de seguridad del Master Gateway para proteger las futuras rutas administrativas del backend. |
| **Shift Left** | ⚠ Parcial | Sanitización/validación de datos de entrada mediante Zod. Consultas parametrizadas con Prisma (evita inyecciones SQL). | Falta el pipeline de análisis estático (SAST) y pruebas unitarias de seguridad. |
| **Sanitización** | ⚠ Parcial | Esquemas Zod tipan estrictamente las entradas de texto. | No existe sanitización explícita contra ataques XSS (por ejemplo, remover código malicioso de campos de texto libre). |
| **Variables de entorno** | ✔ Sí | Archivo `src/config/env.ts` valida todas las variables requeridas en el inicio usando Zod. | Garantiza que la aplicación no corra si hay variables mal configuradas. |
| **Prisma ORM** | ✔ Sí | Configurado en `src/lib/prisma.ts` usando un adaptador PostgreSQL nativo. | Implementado correctamente. |
| **PostgreSQL** | ✔ Sí | Configurado en `docker-compose.yml` usando PostgreSQL 16. | Listo para uso en base de datos relacional. |
| **React** | ✘ No | No existe frontend en el repositorio. | Pendiente de desarrollo (debe ser una SPA). |
| **Frontend SPA** | ✘ No | Ninguno. | Pendiente de desarrollo. |
| **Menú dinámico** | ✘ No | Ninguno. | El frontend debe interceptar el JSON de menús y armar la barra lateral y rutas de forma dinámica en ejecución. |
| **CI/CD** | ✘ No | Ninguno. | Falta configurar el flujo de automatización. |
| **GitHub Actions** | ✘ No | Ninguno. | Falta crear el flujo `.github/workflows/ci-cd.yml`. |
| **SonarCloud** | ✘ No | Ninguno. | Pendiente de integración para calidad y cobertura. |
| **Railway/Render** | ✘ No | Ninguno. | Pendiente de configuración para despliegue por CLI. |
| **Telegram Bot** | ✘ No | Ninguno. | Pendiente de desarrollo y vinculación de tokens en secretos. |

---

## 8. Análisis de Brechas (Gap Analysis)

Para completar el proyecto de acuerdo con la especificación técnica, se priorizan las tareas pendientes de la siguiente manera:

### Prioridad Alta (Fundamentos de Datos y Seguridad Backend)
1. **Extensión del Esquema Prisma**: Incorporar las tablas `Module` y `Menu` (con la relación recursiva `parent_id`) en `schema.prisma`.
2. **Modificación de Semilla (`seed.ts`)**: Añadir la creación de módulos y menús jerárquicos de prueba para asegurar que el sistema inicie poblado.
3. **Middleware de Autenticación y Autorización por Permisos (`auth.middleware.ts`)**: Crear un middleware reutilizable que extraiga el Access Token del encabezado `Authorization: Bearer <token>`, verifique que no esté en la lista negra (`TokenRevocation`) y compruebe que el rol activo contenga los permisos requeridos para la ruta.
4. **Inicialización de Frontend React**: Estructurar la SPA de React utilizando Vite, TypeScript y configurar el Router.

### Prioridad Media (APIs de Administración y Lógica de Menús)
1. **CRUDs de Usuarios y Roles**: Desarrollar los endpoints y servicios para dar de alta, consultar, actualizar e inactivar (soft delete) usuarios y roles. Implementar asignación de usuarios a roles en la tabla intermedia.
2. **CRUD de Módulos**: Desarrollar APIs para la administración de módulos.
3. **CRUD de Menús e Implementación de CTE**: Desarrollar la API de menús, incluyendo el endpoint crítico `GET /api/menus/tree`. Este debe consultar la base de datos de manera eficiente (evitando el problema N+1) utilizando Common Table Expressions (CTE) nativas de PostgreSQL o carga en árbol optimizada por Prisma.
4. **Enrutamiento Dinámico en Frontend**: Consumir la API de menús tras seleccionar un rol en el frontend e inyectar dinámicamente las rutas al enrutador (React Router), de forma que no existan rutas estáticas en el cliente.
5. **Vistas de Administración en Frontend**: Crear pantallas para la administración de los CRUDs creados en el backend.

### Prioridad Baja (DevSecOps e Integraciones Externas)
1. **Pipeline de CI/CD (GitHub Actions)**: Crear el archivo `.github/workflows/ci-cd.yml` para correr pruebas en cada PR y merge a `main`.
2. **Integración con SonarCloud**: Agregar la tarea de SonarCloud en el workflow con verificación del Quality Gate.
3. **Script SAST con Machine Learning**: Desarrollar un script en Python/Docker que analice el código fuente buscando vulnerabilidades lógicas complejas utilizando un modelo pre-entrenado (ej. CodeBERT) e integrarlo en el pipeline.
4. **Automatización de Despliegue**: Configurar la CLI de Railway o Render dentro de GitHub Actions para que despliegue automáticamente en producción si pasan las pruebas y auditorías de seguridad.
5. **Bot de Notificaciones de Telegram**: Programar la integración en el pipeline para notificar el inicio de tareas, estado del Quality Gate, alertas de seguridad de ML y estatus del deploy en el grupo del equipo.

---

## 9. Riesgos Técnicos

1. **Uso de Express.js en lugar de NestJS**: La especificación de tecnologías sugería NestJS. Al usar Express puro, se pierde la inyección de dependencias nativa, los decoradores y el esquema modular estricto de NestJS. Esto traslada al equipo de desarrollo la responsabilidad de mantener el orden y la estructura limpia (Clean Architecture), además de escribir manualmente los middlewares de interceptación y enrutamiento seguro que NestJS provee de caja (Guards, Pipes, Interceptors).
2. **Problema de Consultas N+1 en Menús**: Prisma no soporta de forma nativa la recursividad infinita (`WITH RECURSIVE`) de base de datos a menos que se use `prisma.$queryRaw`. Si se intenta mapear el árbol de menús iterativamente en JavaScript mediante llamadas recurrentes al ORM, se generará una degradación de performance crítica cuando la jerarquía crezca.
3. **Ausencia de Sanitización contra XSS**: Aunque Zod valida formatos (tipo email, longitud de string), no limpia cadenas que contengan etiquetas HTML o scripts maliciosos. Si un administrador inyecta código malicioso en el nombre de un menú o de un usuario, este podría ejecutarse en el frontend de otros usuarios.
4. **Latencia por Inactividad en PaaS Gratuito**: Como se describe en el documento, los PaaS gratuitos (Render/Railway) duermen los contenedores tras 15 minutos de inactividad. Esto puede causar que la primera petición de validación de un microservicio hijo tarde más de 30 segundos, provocando un timeout del cliente.

---

## 10. Recomendaciones de Seguridad (Zero Trust & Shift-Left)

1. **Hooks de Auditoría en Prisma**: Utilizar extensiones de Prisma (Prisma Client Extensions) o middlewares del ORM para interceptar las operaciones de escritura. Esto garantizará de forma automática que los campos `fechaActualizacion` y `actualizadoPor` se completen sin depender de la lógica manual del desarrollador en el servicio, evitando manipulaciones.
2. **Filtros Globales de Soft Delete**: Dado que está prohibido borrar registros físicamente, se debe implementar una extensión de Prisma que intercepte las consultas `find`, `findMany` y `count` para inyectar automáticamente el filtro `where: { estado: 'ACTIVO' }`, evitando fugas de información de registros inactivos.
3. **Sanitización Activa de Entradas**: Integrar librerías como `dompurify` (con `jsdom`) o `sanitize-html` en el backend dentro de un middleware de sanitización global, procesando los cuerpos de las peticiones para limpiar cualquier inyección de scripts antes de persistir la información.
4. **Gestión Segura de Secrets en Desarrollo**: Asegurar que las variables de entorno de producción no se expongan en el código. Configurar Secrets en GitHub para inyectar `JWT_ACCESS_SECRET`, `JWT_TEMP_SECRET`, `INTERNAL_API_KEY` y `DATABASE_URL` durante el despliegue.

---

## 11. Plan de Desarrollo Recomendado (Ramas Git)

Se propone la siguiente estructura de ramas Git partiendo de la rama de desarrollo `dev`, de acuerdo con las dependencias lógicas:

### Detalle de las Ramas

#### 1. Rama `feature/database-extension`
* **Objetivo**: Extender el modelo de base de datos para soportar módulos y menús jerárquicos.
* **Archivos Modificados**: 
  * `prisma/schema.prisma` (Nuevas entidades `Module`, `Menu` y relaciones).
  * `prisma/seed.ts` (Semillas de módulos y menús en árbol).
* **Dependencias**: Ninguna. Es el prerrequisito para las APIs y el frontend.

#### 2. Rama `feature/admin-middlewares`
* **Objetivo**: Implementar los middlewares de autenticación y autorización para las rutas administrativas del backend.
* **Archivos Modificados**: 
  * `src/middlewares/auth.middleware.ts` (Nuevo middleware).
  * `src/app.ts` (Registro de seguridad).
* **Dependencias**: `feature/database-extension`.

#### 3. Rama `feature/crud-users-roles`
* **Objetivo**: Crear los endpoints CRUD para Usuarios y Roles y la asignación intermedia.
* **Archivos Modificados**:
  * `src/modules/users/*` (Rutas, esquemas de validación y servicios de Usuarios).
  * `src/modules/roles/*` (Rutas, esquemas de validación y servicios de Roles).
  * `src/app.ts` (Montaje de rutas `/api/users` y `/api/roles`).
* **Dependencias**: `feature/admin-middlewares`.

#### 4. Rama `feature/crud-modules-menus`
* **Objetivo**: Desarrollar CRUD de módulos y menús, implementando la consulta de árbol jerárquico recursivo (`GET /api/menus/tree`) optimizada con CTE de base de datos.
* **Archivos Modificados**:
  * `src/modules/modules/*` (Rutas, esquemas y servicios de Módulos).
  * `src/modules/menus/*` (Rutas, esquemas y servicios de Menús recursivos).
  * `src/app.ts` (Montaje de rutas `/api/modules` y `/api/menus`).
* **Dependencias**: `feature/database-extension` y `feature/admin-middlewares`.

#### 5. Rama `feature/frontend-init-auth`
* **Objetivo**: Inicializar la SPA de React e integrar el flujo de Login y selección de espacio de trabajo (Workspace Selector).
* **Archivos Modificados**:
  * `frontend/*` (Creación del directorio frontend, Vite config, estructura de componentes de inicio de sesión).
* **Dependencias**: `feature/crud-modules-menus` (se requiere la API de obtención del árbol de menús).

#### 6. Rama `feature/frontend-admin-ui`
* **Objetivo**: Implementar el enrutador dinámico basado en menús (inyección de rutas en tiempo de ejecución) y las pantallas para la gestión de los CRUDs administrativos.
* **Archivos Modificados**:
  * `frontend/*` (Vistas de administración y lógica del enrutador dinámico).
* **Dependencias**: `feature/frontend-init-auth`.

#### 7. Rama `feature/ci-cd-devsecops`
* **Objetivo**: Configurar toda la infraestructura de integración y entrega continua (pipeline, SonarCloud, modelo de ML, deploy y notificaciones de Telegram).
* **Archivos Modificados**:
  * `.github/workflows/ci-cd.yml` (Configuración del pipeline).
  * Creación de scripts/contenedores para el motor de CodeBERT SAST.
  * Script de integración para notificaciones por Telegram.
* **Dependencias**: Todas las ramas previas (se realiza como paso integrador antes de pasar a QA/producción).
