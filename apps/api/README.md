# HQ Management API

The API is a NestJS REST application using the Express platform adapter,
TypeORM, and PostgreSQL. It provides authentication, company/outlet-scoped
access, shared master-menu management, outlet menu assignments, inventory,
sales, and reports.

- API prefix: `/api/v1`
- Local API: `http://localhost:3001`
- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs/json`

For repository-wide setup and architecture, see the
[root README](../../README.md), [architecture documentation](../../docs/architecture.md),
[API endpoint reference](../../docs/api-endpoints.md), and
[scaling plan](../../docs/scaling-plan.md).

## Requirements

- Node.js 24 and npm
- PostgreSQL 13 or later (local Docker setup uses PostgreSQL 17)

## Configure the environment

From `apps/api`, create the environment file:

```sh
cp .env.example .env
```

Set the database credentials and replace the JWT placeholder with a private
random secret of at least 32 characters. For a local PostgreSQL service, use
`DB_HOST=localhost`. When running through the root Docker Compose stack, use
`DB_HOST=hq-db`; Compose reads the database values from this file.

Add `NODE_ENV=development` to `.env`; it is required by API startup but is not
currently listed in `.env.example`. `PORT` defaults to `3001`. The example
contains database connection values, JWT/session configuration, and request
throttling settings. Never commit `.env` or use development credentials in
production.

## Install, migrate, and run

Install dependencies and apply database migrations:

```sh
npm ci
npm run migration:run
```

Start the API in watch mode:

```sh
npm run start:dev
```

The root Docker Compose configuration also applies migrations to the API
container after startup. For a convenient local full-stack setup, follow the
[root README Docker Compose instructions](../../README.md#run-locally-with-docker-compose).

Useful migration commands (run from `apps/api`):

```sh
npm run migration:show
npm run migration:generate -- src/database/migrations/DescribeChange
npm run migration:revert
```

Review generated migrations before applying them. TypeORM schema synchronization
is disabled; schema changes must use migrations.

## Development seed data

The development seed creates `admin@example.test`, `manager@example.test`,
`staff@example.test`, and sample company/outlet, menu, inventory, and sales
data. Set `SEED_HQ_ADMIN_PASSWORD`, `SEED_OUTLET_MANAGER_PASSWORD`, and
`SEED_OUTLET_STAFF_PASSWORD` in `.env` to override the development-only
fallback passwords. Passwords must be at least 12 characters and no more than
72 UTF-8 bytes; they are hashed and must not be committed. Never use seed
accounts in production. Seeds are blocked when `NODE_ENV=production`.

```sh
npm run seed:db
```

Alternatively, `npm run seed` builds the API before seeding. From the repository
root, use `make seed-run` with the Compose stack running.

## API modules and structure

```text
src/
  modules/
    auth/                 Login, refresh, sessions, password, JWT
    health/               Database and disk health checks
    menu-items/           Shared master menu CRUD
    outlets/              Company-scoped outlet listing
    outlet-menu-items/    Outlet assignments and price overrides
    inventories/          Outlet stock listing and adjustment
    sales/                Sale creation, history, and details
    reports/              Revenue and top-selling item reports
  database/
    entities/             TypeORM entities and relationships
    migrations/           Versioned PostgreSQL schema changes
    seeds/                Development/demo data
  common/                 Guards, decorators, DTOs, filters, pipes, utilities
  config/                 Environment validation
  main.ts                 Bootstrap, versioning, Swagger, global handling
```

Each feature module groups controllers, services, and DTOs. Controllers define
routes and Swagger metadata; services enforce business rules and use TypeORM
repositories or transaction managers for data access. Shared request
validation, authentication/role guards, exception filters, and response
handling are configured centrally.

## Authentication and tenant access

Most endpoints require a bearer access token. The API supports `SUPER_ADMIN`,
`HQ_ADMIN`, `OUTLET_MANAGER`, and `OUTLET_STAFF` roles. Super admins operate
across companies; HQ admins are scoped to their company; outlet users are
scoped to their assigned outlet. Role and data scope are enforced by the API,
not only by the web UI.

The master `menu_items` catalog is shared globally. Outlets receive items
through `outlet_menu_items`, which can specify an outlet price override.

## Sales and data integrity

Sale creation checks outlet menu availability and stock, allocates a
per-outlet sequential receipt, deducts inventory, and saves sale items within
a database transaction. An optional `Idempotency-Key` supports safe request
retries. Database constraints enforce receipt/idempotency uniqueness and
non-negative stock. Sale items retain the unit price and line total used when
the sale was made.

See Swagger and [API endpoint reference](../../docs/api-endpoints.md) for all routes,
request/response schemas, query parameters, and status codes.

## Scripts

Run from `apps/api`:

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Start NestJS in watch mode |
| `npm run build` | Compile TypeScript to `dist` |
| `npm run start:prod` | Run the compiled API |
| `npm run lint` | Run Oxlint on API source and tests |
| `npm test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run API end-to-end tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:show` | Show migration status |
| `npm run db:setup` | Apply migrations and run development seeds |

## License

This application is private and marked `UNLICENSED` in its package manifest.
