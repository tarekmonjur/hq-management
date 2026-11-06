# HQ Management

HQ Management is a web application for managing a company's outlets and their
menus. The repository contains a Next.js web app, a NestJS REST API, and a
PostgreSQL database. The API provides authentication, health checks, outlet and
menu-item management, and outlet-specific menu-item pricing.

## Architecture

- **Web:** Next.js App Router application at `apps/web`. The UI is served at
  `http://localhost:3000`. Server-side web routes proxy requests to the API.
- **API:** NestJS application at `apps/api`. Versioned endpoints use the
  `/api/v1` prefix; Swagger documentation is available at
  `http://localhost:3001/api-docs`.
- **Database:** PostgreSQL 17, available on port `5432`.
- **Local orchestration:** Docker Compose starts the database, API, and web
  app. The API applies database migrations during startup.

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

The seed creates the development admin account `admin@example.test` and
development sample data. Use the configured password to sign in. Seed data is
for development only; never use a development password in production.

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