# Architecture Documentation

This document describes the current HQ Management implementation. Scaling,
microservices, and offline POS/KDS recommendations are proposals, not claims
that those capabilities are already deployed. See the separate
[Scaling Plan](./scaling-plan.md) for the full workload and evolution strategy.

## Technology and system context

- **Web application:** Next.js App Router with React, served at port `3000`.
- **Backend API:** NestJS REST API (using the Express platform adapter), served
  at port `3001`, with URI versioning under `/api/v1`.
- **Persistence:** PostgreSQL 17 accessed with TypeORM and explicit migrations.
- **API reference:** Swagger UI at `/api-docs`; the route summary is in
  [API_ENDPOINTS.md](./API_ENDPOINTS.md).
- **Local orchestration:** Docker Compose starts PostgreSQL, API, and web app.
  Compose and Dockerfiles are development/local setup, not evidence of a
  production deployment.

```mermaid
flowchart LR
    Browser[Browser / React UI]
    Next[Next.js App Router and server routes]
    Proxy[Next.js backend-for-frontend proxy]
    API[NestJS REST API]
    Auth[JWT authentication and session management]
    Modules[Feature modules: auth, catalog, outlets, inventory, sales, reports]
    ORM[TypeORM entities and repositories]
    DB[(PostgreSQL)]
    Swagger[Swagger UI / OpenAPI]
    Compose[Docker Compose for local development]

    Browser -->|HTTP-only session cookie| Next
    Next --> Proxy
    Proxy -->|Authorization header, JSON, /api/v1| API
    API --> Auth
    API --> Modules
    Auth --> ORM
    Modules --> ORM
    ORM --> DB
    API -. documents .-> Swagger
    Compose -. runs .-> Next
    Compose -. runs .-> API
    Compose -. runs .-> DB
```

### Request, authentication, and data flow

1. A user interacts with Next.js pages/components. Browser requests to the
   backend route are handled by the Next.js server-side proxy.
2. The proxy reads HTTP-only session cookies, attaches the API access token,
   forwards the request to NestJS, and refreshes the session when appropriate.
   The login route calls the API and writes the session cookies.
3. NestJS applies request validation, authentication/role guards, feature
   services, response handling, and exception handling before TypeORM accesses
   PostgreSQL.
4. The UI uses shared API client functions and React Query for data fetching
   and mutation state.

The API validates environment variables at startup, uses DTO-based validation,
and defines a global response interceptor and exception filters. Access to
features is both role- and tenant-scoped in the backend; hiding a UI control is
not the authorization boundary.

## Repository structure

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/       # Nest controllers, services, DTOs, feature tests
│   │   │   ├── database/      # TypeORM entities, migrations, seeds
│   │   │   ├── common/        # Guards, filters, pipes, DTOs, shared utilities
│   │   │   ├── config/        # Environment validation/configuration
│   │   │   ├── app.module.ts
│   │   │   └── main.ts        # Bootstrap, validation, Swagger, global handling
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/
│       ├── app/               # App Router pages, layouts, and server routes
│       ├── components/        # Dashboard, POS, reports, and reusable UI
│       ├── lib/
│       │   ├── api/           # API client and typed feature requests
│       │   ├── auth/          # Cookie/session and role helpers
│       │   └── validations/   # Client-side schemas
│       ├── Dockerfile
│       └── package.json
├── docs/                      # API, architecture, scaling, and client docs
├── .husky/                    # Git hooks
├── commitlint.config.mjs
├── docker-compose.yml
└── Makefile
```

### API layering

Each NestJS feature module groups controllers, services, and DTOs. Controllers
define HTTP routes and role/API metadata; services implement business rules and
use TypeORM repositories or transaction managers for data access. This is a
layered modular monolith; there is not a separate repository class for every
entity. Shared guards, decorators, validation, exception handling, and response
formatting live under `apps/api/src/common`.

### Web application responsibilities

Next.js App Router pages and layouts compose the UI. Feature components render
the dashboard, outlet/menu management, POS, sales, and reporting experiences.
Typed functions under `apps/web/lib/api` communicate with the same-origin
backend proxy, while `apps/web/lib/auth` and the server route handlers manage
session cookies and API token forwarding.

## Data model and relationships

```mermaid
erDiagram
    COMPANY ||--o{ OUTLET : owns
    COMPANY o|--o{ USER : scopes
    OUTLET o|--o{ USER : assigns
    USER ||--o{ USER_SESSION : has
    OUTLET ||--o{ OUTLET_MENU_ITEM : offers
    MENU_ITEM ||--o{ OUTLET_MENU_ITEM : assigned_as
    OUTLET ||--o{ INVENTORY : stocks
    MENU_ITEM ||--o{ INVENTORY : stocked_as
    OUTLET ||--o{ SALE : records
    SALE ||--|{ SALE_ITEM : contains
    MENU_ITEM ||--o{ SALE_ITEM : referenced_by
    OUTLET ||--o| OUTLET_RECEIPT_COUNTER : sequences

    COMPANY {
        uuid id PK
        string name UK
    }
    OUTLET {
        uuid id PK
        uuid company_id FK
        string code
        string name
        string location
    }
    USER {
        uuid id PK
        uuid company_id FK
        uuid outlet_id FK
        string email UK
        string role
        boolean is_active
    }
    USER_SESSION {
        uuid session_id PK
        uuid user_id FK
        string refresh_token_hash
        datetime expires_at
        datetime absolute_expires_at
        datetime revoked_at
    }
    MENU_ITEM {
        uuid id PK
        string name UK
        decimal base_price
        string unit
    }
    OUTLET_MENU_ITEM {
        uuid id PK
        uuid outlet_id FK
        uuid menu_item_id FK
        decimal outlet_price
        boolean is_active
    }
    INVENTORY {
        uuid id PK
        uuid outlet_id FK
        uuid menu_item_id FK
        integer quantity
    }
    SALE {
        uuid id PK
        uuid outlet_id FK
        bigint receipt_no
        decimal total
        string idempotency_key
        string order_status
        string payment_status
    }
    SALE_ITEM {
        uuid id PK
        uuid sale_id FK
        uuid menu_item_id FK
        integer quantity
        decimal unit_price
        decimal line_total
    }
    OUTLET_RECEIPT_COUNTER {
        uuid outlet_id PK, FK
        bigint last_number
    }
```

### Tenant boundaries and business rules

- A company owns multiple outlets. Company and outlet users are associated
  through `users.company_id` and `users.outlet_id`; backend services scope
  company administrators to their company and outlet roles to their outlet.
- The master `menu_items` catalog is **shared globally**, as confirmed for this
  project. It has no `company_id`. `outlet_menu_items` controls which items
  each outlet offers, whether the assignment is active, and an optional
  outlet-specific price override.
- Inventory is keyed by outlet and menu item. Database constraints prohibit
  negative quantities. Sale creation locks inventory rows and deducts stock
  within a database transaction.
- A sale belongs to one outlet; its line items store `unit_price` and
  `line_total` at sale time. This snapshot preserves historical amounts if a
  menu price changes later.
- Receipt counters are per outlet. An atomic counter update and unique
  `(outlet_id, receipt_no)` constraint protect receipt uniqueness during
  concurrent requests. `(outlet_id, idempotency_key)` protects sale retries.
- Foreign keys and unique/check constraints enforce important relations and
  invariants. Indexes support outlet/date sales lookups, status filtering,
  outlet/menu assignment lookups, and session/user queries.

## Operational and delivery notes

- `docker-compose.yml` and the per-app Dockerfiles support the repository's
  local development workflow. See [README setup](../README.md#run-locally-with-docker-compose).
- API detail and interactive schemas: `/api-docs`; concise route list:
  [API endpoints](./API_ENDPOINTS.md).
- Commit messages are checked by the Husky `commit-msg` hook using Commitlint
  and Conventional Commits; details and examples are in the README.
- The separate [Scaling Plan](./scaling-plan.md) describes the requested
  transaction volume, reporting, infrastructure, microservices, and offline
  POS/KDS evolution.
