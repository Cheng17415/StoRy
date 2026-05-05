# StoRy

Proyecto DAM: inventario tipo BOM. Incluye **backend** (Spring Boot) y **frontend** (Angular).

## Inicio rápido (scripts)

Desde la **raíz del repositorio** (donde están `backend/`, `frontend/` y `scripts/`):

| Qué | PowerShell | CMD |
|-----|------------|-----|
| Backend | `.\scripts\start-backend.ps1` | `scripts\start-backend.cmd` |
| Frontend | `.\scripts\start-frontend.ps1` | `scripts\start-frontend.cmd` |

El backend usa `backend\mvnw.cmd spring-boot:run`. El frontend ejecuta `npm run start` en `frontend/` (Angular en `http://localhost:4200` con **proxy** a `http://localhost:8080` definido en `frontend/proxy.conf.json`).

Orden habitual: 1) PostgreSQL en marcha, 2) backend, 3) frontend.

## Backend (`backend/`)

Requisitos: **JDK 17+** y **PostgreSQL** (el perfil por defecto es `dev` y espera la base en `localhost`).

**Flyway:** si creaste las tablas a mano con `scripts/postgres/init_complete.sql` (sin tabla `flyway_schema_history`), el backend está configurado con `baseline-on-migrate` para alinear Flyway con ese esquema. En una base **vacía**, Flyway sigue aplicando `V1__init.sql` con normalidad.

### Base de datos PostgreSQL

Credenciales por defecto del proyecto: usuario `story`, contraseña `story`, base `story` (véase `backend/src/main/resources/application-dev.yml`).

**Opción A – Docker Compose (recomendado si tienes Docker)**

En la raíz del repositorio:

```bash
docker compose up -d
```

Eso crea usuario, contraseña y base `story`. Las **tablas** las crea **Flyway** la primera vez que arrancas el backend (`spring-boot:run`).

**Opción B – Script SQL completo (rol + base + tablas) con `psql`**

Útil si tienes PostgreSQL instalado y quieres el DDL sin depender de Flyway (por ejemplo para inspección en pgAdmin). Desde la raíz del repo, como superusuario `postgres`:

```bash
# Windows PowerShell (ajusta la contraseña de postgres)
$env:PGPASSWORD = "tu_password_postgres"
psql -h localhost -p 5432 -U postgres -v ON_ERROR_STOP=1 -f scripts/postgres/init_complete.sql
```

Si `psql` no está en el PATH, usa la ruta del ejecutable (ajusta la versión si no es la 18):

```powershell
$env:PGPASSWORD = "tu_password_postgres"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -v ON_ERROR_STOP=1 -f scripts/postgres/init_complete.sql
```

Puedes añadir `C:\Program Files\PostgreSQL\18\bin` a la variable de entorno **Path** de Windows para invocar `psql` sin ruta completa.

Si tras el `\c` pide contraseña del rol `story`: `$env:PGPASSWORD = "story"` y vuelve a ejecutar solo la parte de tablas, o ejecuta en dos pasos los archivos `scripts/postgres/01_create_role_and_database.sql` y luego `02_schema.sql` conectado a `story`.

**Importante:** si ya aplicaste `init_complete.sql` (tablas creadas), no mezcles con Flyway en la misma base sin alinear el historial de migraciones; lo habitual con este repo es **Compose + Flyway** o **init_complete.sql** para un entorno solo SQL.

**Opción C – Docker sin Compose**

```bash
docker run --name story-postgres -e POSTGRES_USER=story -e POSTGRES_PASSWORD=story -e POSTGRES_DB=story -p 5432:5432 -d postgres:16
```

Luego arranca el backend para que **Flyway** aplique `backend/src/main/resources/db/migration/V1__init.sql`.

### Ejecutar la API

Desde la raíz del repo: `.\scripts\start-backend.ps1` o `scripts\start-backend.cmd`.

O desde la carpeta `backend`:

```bash
.\mvnw.cmd spring-boot:run
```

En Linux o macOS:

```bash
./mvnw spring-boot:run
```

Perfil y datasource por defecto están en `application-dev.yml`. Para producción, define por ejemplo `SPRING_PROFILES_ACTIVE=prod` y las propiedades `spring.datasource.*` (o variables equivalentes) sin commitear secretos.

### Endpoints de ejemplo

- `GET http://localhost:8080/api/categorias`
- `GET http://localhost:8080/api/productos`
- `GET http://localhost:8080/actuator/health`

### Tests

```bash
.\mvnw.cmd verify
```

El perfil `test` usa H2 en memoria y desactiva Flyway para comprobar que el contexto Spring arranca.

## Frontend (`frontend/`)

Requisitos: **Node.js** (LTS recomendado) y **npm**.

Marca: favicon y logo en `frontend/public/story-logo.png` (cabecera e `index.html`). Colores en `src/styles.scss` (`--story-primary`, `--story-bg-header`, etc.).

Estructura principal (`src/app/`):

```text
app/
├── core/                 # Servicios y modelos reutilizables
│   ├── models/           # DTOs / interfaces (p. ej. catalogo.models.ts)
│   └── services/         # p. ej. CatalogoApiService (llamadas HTTP a /api)
├── shared/               # Componentes, directivas y pipes compartidos
├── features/             # Pantallas por dominio
│   ├── home/
│   └── catalogo/         # Categorías y productos (ejemplo con lazy loading)
├── app.config.ts
├── app.routes.ts
└── app.component.*
```

Arranque: `.\scripts\start-frontend.ps1` o `cd frontend && npm run start`. La app usa rutas perezosas y `provideHttpClient()` para consumir el API a través del proxy de desarrollo.

Build de producción: `cd frontend && npm run build`.

## Esquema de datos

Ver [estructura.txt](estructura.txt) (modelo PostgreSQL: usuarios, perfiles, categorías, productos, movimientos de stock).
