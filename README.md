# HQ Management

HQ Management is a multi-company HQ application for managing outlets, a shared
master menu, outlet-specific menus and prices, inventory, sales, and reports.
The repository contains a Next.js/React web app, a NestJS REST API using the
Express adapter, and a PostgreSQL database.

## Architecture

- **Web:** Next.js App Router application at `apps/web`. The UI is served at
  `http://localhost:3000`. Server-side web routes proxy requests to the API.
- **API:** NestJS application at `apps/api`. Versioned endpoints use the
  `/api/v1` prefix; Swagger documentation is available at
  `http://localhost:3001/api-docs`.
- **Database:** PostgreSQL 17, available on port `5432`.
- **Local orchestration:** Docker Compose starts the database, API, and web
  app. The API applies database migrations during startup.
- **Deployment:** The project is prepared for local Docker Compose use. A
  production instance URL will be published here after hosting is selected and
  the deployment is verified.

See [Architecture Documentation](docs/architecture.md) for the component
diagram, ERD, folder responsibilities, and data/business rules. The separate
[Scaling Plan](docs/scaling-plan.md) covers the client workload scenario,
microservices evolution, and future offline POS/KDS strategy.

## Repository structure

```text
apps/
  api/
    src/modules/       NestJS feature modules (controllers, services, DTOs)
    src/database/      TypeORM entities, migrations, and seed data
    src/common/        Shared guards, filters, pipes, DTOs, and utilities
    src/config/        Environment validation
  web/
    app/               Next.js routes, pages, layouts, and server handlers
    components/        Dashboard, menu, POS, sales, reports, and UI
    lib/api/           Typed API client functions
    lib/auth/          Session cookies and role helpers
    lib/validations/   Client-side input schemas
docs/                  API, architecture, scaling, and client documentation
.husky/                Git hooks, including commit-msg validation
```

## API endpoint summary

All API routes use the `/api/v1` prefix. Detailed schemas, parameters,
validation, and errors are in [Swagger](http://localhost:3001/api-docs) while
the route list is maintained in [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md).
Unless noted, routes require authentication. `HQ_ADMIN` is company-scoped,
outlet roles are outlet-scoped, and `SUPER_ADMIN` can access across companies.

| Method | Endpoint | Purpose / access |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Public API and database health check |
| `POST` | `/api/v1/auth/login` | Sign in (public) |
| `POST` | `/api/v1/auth/refresh` | Refresh session tokens (public) |
| `GET` | `/api/v1/auth/me` | Current authenticated profile |
| `GET` | `/api/v1/menu-items` | List/search shared master menu (HQ/Super admin) |
| `POST` | `/api/v1/menu-items` | Create master item (HQ/Super admin) |
| `GET` | `/api/v1/outlets` | List outlets in permitted company scope (HQ/Super admin) |
| `POST` | `/api/v1/outlet-menu-items` | Assign menu item to outlet (HQ/Super admin) |
| `GET` | `/api/v1/outlet-menu-items` | List assigned outlet menus in permitted scope |
| `GET` | `/api/v1/inventories` | List inventory in permitted scope |
| `PUT` | `/api/v1/inventories/:inventoryId` | Set stock quantity (HQ/Super admin) |
| `POST` | `/api/v1/sales` | Create sale; transactionally deduct stock and allocate receipt |
| `GET` | `/api/v1/sales` | Search and paginate sales in permitted scope |
| `GET` | `/api/v1/reports/revenue` | Revenue by outlet/date range in permitted scope |
| `GET` | `/api/v1/reports/top-items` | Top-selling items in permitted scope |

The sale endpoint accepts an optional `Idempotency-Key` header for safe
retries. Outlet receipt numbers are allocated sequentially per outlet by the
API while online. See the Swagger specification for all auth/session and
feature routes.

## Database schema overview

PostgreSQL stores companies and their outlets/users; menu items form a **shared
global catalog** and are linked to outlets through outlet-menu assignments.
Assignments can override prices. Inventory is tracked per outlet and item.
Sales belong to an outlet and contain sale-item snapshots of quantity and
price; an outlet-scoped receipt counter and idempotency key protect concurrent
sale creation and retries. Foreign keys, unique constraints, non-negative
stock/price checks, and indexes enforce and support these rules.

The API uses TypeORM migrations rather than schema synchronization. Review
[Architecture Documentation](docs/architecture.md) for the ERD, detailed
relationships, tenant boundaries, and migration/entity caveats.

## Clean commits

The repository uses **Husky** to run **Commitlint** from the `commit-msg` Git
hook. Commit messages follow the Conventional Commits format, for example:

```text
feat: add outlet sales report
fix: prevent duplicate receipt allocation
docs: describe offline POS strategy
```

Install the root development dependencies and run the repository's prepare
script to configure the hook (`npm install` runs `prepare`).

## Prerequisites

- Docker with the Docker Compose plugin
- GNU Make (optional; used for the helper commands below)

Ports `3000`, `3001`, and `5432` must be available.

## Run locally with Docker Compose

1. Create the API environment file:

   ```sh
   cp apps/api/.env.example apps/api/.env
   ```

2. Edit `apps/api/.env` for the Docker Compose setup:

   - Set `DB_HOST=hq-db` so the API can reach PostgreSQL over the Compose
     network. (`localhost` is for running the API directly on your machine.)
   - Set `JWT_SECRET` to a private random string of at least 32 characters.
   - Set database credentials as desired. These values are also used to
     initialize the local PostgreSQL container.

3. Create `apps/web/.env` with the API's Compose service URL:

   ```dotenv
   API_URL=http://hq-api:3001
   ```

   The web server makes API requests from inside the Compose network, so use
   `hq-api` as the hostname rather than `localhost`.

4. Build and start the services from the repository root:

   ```sh
   docker compose --env-file ./apps/api/.env up --build
   ```

   `--env-file` supplies the database values used by Compose as well as the
   API's environment. Keep the command's `--env-file` option when using other
   Compose commands, for example:

   ```sh
   docker compose --env-file ./apps/api/.env down
   ```

5. Open:

   - Web app: `http://localhost:3000`
   - API health check: `http://localhost:3001/api/v1/health`
   - API Swagger docs: `http://localhost:3001/api-docs`

The web container keeps its Linux `node_modules` in a separate volume from the
host-mounted source tree. This avoids host/container native dependency
mismatches during development.

### Optional: load development seed data

Set `SEED_HQ_ADMIN_PASSWORD` in `apps/api/.env` to a development-only password,
then run:

```sh
make seed-run
```

The seed creates the development sample data. Use the configured password to sign in. Seed data is
for development only; never use a development password in production.

## Pre-Seeded Test Accounts (Role Access Hierarchy)

The application includes seeded accounts with distinct role permissions for end-to-end testing:

- **Role**: HQ Administrator
  - **Email**: admin@example.test **Password**: Admin@123456
  - **Scope & Permitted Actions**: Master Menu management, multi-outlet menu assignment & price overrides, consolidated company-wide sales and revenue reports.
- **Role**: Outlet Manager
  - **Email**: manager@example.test **Password**: Manager@123456
  - **Scope & Permitted Actions**: Scoped strictly to Outlet 1: Assigned outlet menu viewing, POS checkout, sales history, and outlet reports. Cannot view other outlets or master menu catalog.
- **Role**: Outlet Staff
  - **Email**: staff@example.test **Password**: Staff@123456
  - **Scope & Permitted Actions**: Scoped strictly to Outlet 2: POS terminal sales, order lookup, and outlet reports.

## Makefile commands

The Makefile targets wrap Docker Compose and automatically use
`apps/api/.env`. Create and configure that file as described above before
running a target. Run commands from the repository root. See the full list at
any time with `make help`.

| Command | What it does |
| --- | --- |
| `make` or `make default` | Build and start the development stack; same as `make up`. |
| `make help` | Print the available targets and usage hints. |
| `make up` | Build images if needed, then start the services in the foreground. Press `Ctrl+C` to stop viewing them; use `make down` to stop the services. |
| `make build` | Build the Compose service images without starting them. |
| `make down` | Stop and remove the Compose containers and network. Database data remains in its named volume. |
| `make restart` | Restart all services. Use `make restart service=hq-web` to restart one service. |
| `make logs` | Follow logs from all services. Use `make logs service=hq-api` to follow one service. Press `Ctrl+C` to stop following logs. |
| `make ps` | Show the status of Compose services. |
| `make docker-config` | Validate and print the resolved Compose configuration. |
| `make api-shell` | Open a shell in the running API container. |
| `make db-shell` | Open a `psql` prompt in the running PostgreSQL container. |
| `make migration-run` | Apply pending API database migrations. |
| `make migration-show` | Show which API database migrations have run or are pending. |
| `make migration-revert` | Revert the most recently applied API migration. |
| `make migration-generate name=AddNewTable` | Generate a migration named `AddNewTable` from API entity/schema changes. Review the generated migration before applying it. |
| `make seed-run` | Load the development/demo seed data. Set `SEED_HQ_ADMIN_PASSWORD` in `apps/api/.env` first. |

Commands that execute inside a container (shell, migration, or seed targets)
require the relevant service to be running. Start the stack first with
`make up`. The API applies pending migrations at container startup, so running
`make migration-run` is normally only needed after creating new migrations or
when applying them manually.

`make migration-revert` changes the database schema by undoing the latest
migration; use it only when that is intended. `make down` preserves the
database volume. To permanently delete the local database and its data, use
`docker compose --env-file ./apps/api/.env down --volumes`.

## Run services without Docker

For running the API and web app directly on your machine, install Node.js 24
and npm, and start a PostgreSQL server. Install dependencies in each app:

```sh
cd apps/api && npm ci
cd ../web && npm ci
```

Configure `apps/api/.env` with `NODE_ENV=development`, `DB_HOST=localhost`, and
the credentials for your local PostgreSQL instance. Set `JWT_SECRET` to a
private random string of at least 32 characters. For the web app, set
`API_URL=http://localhost:3001` in `apps/web/.env`.

Start the API and web app in separate terminals from their respective
directories:

```sh
# Terminal 1: apps/api
npm run start:dev

# Terminal 2: apps/web
npm run dev
```

Run API migrations after PostgreSQL is available:

```sh
# From apps/api
npm run migration:run
```

## Development commands

API commands (run from `apps/api`):

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

Web commands (run from `apps/web`):

```sh
npm run build
npm run lint
```