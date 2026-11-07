# HQ Management Web Application

The web application is built with Next.js App Router and React. It provides
the HQ Management dashboard, menu and outlet-menu administration, point of
sale, sales history, and reports.

- Local web app: `http://localhost:3000`
- Backend API: NestJS at `http://localhost:3001` by default
- API docs: `http://localhost:3001/api-docs`

For the full-stack setup, see the [root README](../../README.md). For system
design and database relationships, see
[architecture documentation](../../docs/architecture.md) and the separate
[scaling plan](../../docs/scaling-plan.md).

## Requirements

- Node.js 24 and npm
- A running HQ Management API and PostgreSQL database

## Configure and run locally

From `apps/web`, create a local environment file:

```sh
printf 'API_URL=http://localhost:3001\n' > .env.local
```

`API_URL` is used by Next.js server routes to reach the NestJS API. It is
server-side configuration: use `http://hq-api:3001` when the web app runs in
the root Docker Compose network, and `http://localhost:3001` when running the
web app directly on your machine.

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API and database must
also be configured and running. To start the full local stack with Docker,
follow the [root README](../../README.md#run-locally-with-docker-compose).
Do not commit `.env.local` or production secrets.

## Application structure

```text
app/
  (auth)/login/                Login page
  (dashboard)/                 Dashboard, POS, menus, outlets, sales, reports
  api/auth/                     Login and logout server handlers
  api/backend/[...path]/        Authenticated proxy to the NestJS API
components/
  auth/                         Login form
  dashboard/                    Dashboard shell and overview
  menu-items/                   Master menu management
  outlet-menu-items/            Outlet menu assignments and pricing
  sales/                        POS terminal, sale list, details, receipt
  reports/                      Revenue and top-items presentation
  ui/                           Shared UI primitives
lib/
  api/                          Typed API client and feature requests
  auth/                         Cookie, session, and role helpers
  validations/                  Client-side input schemas
```

The browser uses same-origin Next.js routes for backend requests. The server
proxy forwards requests to NestJS and attaches the access token from HTTP-only
session cookies; login and token refresh are handled through server routes.
Feature request functions use the shared API client, and React Query manages
client-side queries and mutations.

The UI includes login, a role-aware dashboard, master menu and outlet menu
management, outlet selection, POS sale creation, receipts, sales history, and
revenue/top-items reports. The POS sends an idempotency key with sale requests
to make retrying an online request safe. Offline POS synchronization and KDS
functionality are not currently implemented.

## Scripts

Run from `apps/web`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Configuration and deployment

Set `API_URL` in the server environment to the reachable NestJS API base URL.
For local development this defaults to `http://localhost:3001`; in Docker
Compose use `http://hq-api:3001`. Configure production environment values in
the hosting provider's secure environment settings, not in this repository.

The repository includes a web Dockerfile for container builds. Production
deployment must also provide the API, PostgreSQL, secure environment
configuration, and migrations; a Dockerfile by itself is not a deployed
instance.

## License

This application is private and marked `UNLICENSED` in its package manifest.
