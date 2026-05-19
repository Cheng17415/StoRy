# StoRy

Proyecto DAM: inventario tipo BOM. Incluye **backend** (Spring Boot) y **frontend** (Angular).

La base de datos es **PostgreSQL en Supabase** (no hay Postgres local en el repositorio).

## Inicio rápido (scripts)

Desde la **raíz del repositorio** (donde están `backend/`, `frontend/` y `scripts/`):

| Qué | PowerShell | CMD |
|-----|------------|-----|
| Backend | `.\scripts\start-backend.ps1` | `scripts\start-backend.cmd` |
| Frontend | `.\scripts\start-frontend.ps1` | `scripts\start-frontend.cmd` |

El backend usa `backend\mvnw.cmd spring-boot:run` y lee **`.env`** en la raíz (Supabase + OAuth + Resend). El frontend ejecuta `npm run start` en `frontend/` (Angular en `http://localhost:4200` con **proxy** a `http://localhost:8080` definido en `frontend/proxy.conf.json`).

Orden habitual: 1) copiar `.env.example` → `.env` y rellenar credenciales de Supabase, 2) backend, 3) frontend.

## Backend (`backend/`)

Requisitos: **JDK 17+** y proyecto **Supabase** con la base ya creada (esquema vía Flyway o migraciones previas).

### Configuración Supabase

1. En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **Connect** → **Session mode** (pooler, IPv4).
2. Copia host, usuario (`postgres.<project_ref>`) y contraseña de base de datos.
3. En la raíz del repo, `.env` (plantilla en `.env.example`):

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres.<project_ref>
SPRING_DATASOURCE_PASSWORD=<contraseña Database>
```

**Nota:** el host directo `db.<ref>.supabase.co` suele ser solo IPv6; en Windows/red sin IPv6 usa el **Session pooler** del dashboard (p. ej. `aws-1-<region>.pooler.supabase.com`).

**Flyway:** en el primer arranque contra una base vacía aplica `backend/src/main/resources/db/migration/`. Si el esquema ya existe sin `flyway_schema_history`, el perfil `dev` hace baseline en la versión 8.

### Ejecutar la API

Desde la raíz del repo: `.\scripts\start-backend.ps1` o `scripts\start-backend.cmd`.

O desde la carpeta `backend` (con las variables `SPRING_DATASOURCE_*` exportadas):

```bash
.\mvnw.cmd spring-boot:run
```

En Linux o macOS:

```bash
./mvnw spring-boot:run
```

Para producción, define `SPRING_PROFILES_ACTIVE=prod` y las propiedades `spring.datasource.*` sin commitear secretos.

### Imágenes (Supabase Storage)

Las fotos de productos y carpetas se suben al bucket público **`imagenes`** en Supabase Storage. En `.env` añade además de `SUPABASE_URL` la clave **`SUPABASE_SERVICE_ROLE_KEY`** (Dashboard → Project Settings → API → `service_role`, solo backend).

La API guarda en base de datos la URL pública, por ejemplo:

`https://<project_ref>.supabase.co/storage/v1/object/public/imagenes/<uuid>.png`

Las rutas antiguas `/api/files/...` siguen sirviéndose desde disco local si aún existen ficheros en `~/.story/uploads`.

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

Ver [estructura.txt](estructura.txt) y [documentacion/StoRy-guia-tecnica.md](documentacion/StoRy-guia-tecnica.md) (modelo PostgreSQL e inventario multi-empresa).

Los scripts en `scripts/postgres/` son históricos (entorno local); el entorno oficial es Supabase + Flyway.
