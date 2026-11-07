# API Endpoints

The API is versioned under `/api/v1`. Swagger UI is the detailed, executable
reference for request/response schemas, validation rules, status codes, and
authentication:

- Local: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs/json`

Unless noted as public, endpoints require a bearer access token. The
`SUPER_ADMIN` role can operate across companies; `HQ_ADMIN` is scoped to its
company; outlet roles are scoped to their assigned outlet. Endpoint-specific
role restrictions are shown below; consult Swagger and the controllers for
full authorization details.

## Health

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Public | Checks database connectivity and disk usage. |

## Authentication

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Public | Processes account registration. |
| `POST` | `/api/v1/auth/login` | Public | Authenticates and creates a session/token pair. |
| `POST` | `/api/v1/auth/refresh` | Public | Rotates/refreshes the session token pair. |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes the current session. |
| `POST` | `/api/v1/auth/logout/all` | Authenticated | Revokes all active sessions. |
| `GET` | `/api/v1/auth/sessions` | Authenticated | Lists the caller's active sessions. |
| `DELETE` | `/api/v1/auth/sessions/:id` | Authenticated | Revokes a session. |
| `POST` | `/api/v1/auth/password/change` | Authenticated | Changes the caller's password. |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns the current user's profile. |

## Menu and outlets

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/menu-items` | HQ/Super admin | Creates a shared master menu item. |
| `GET` | `/api/v1/menu-items` | HQ/Super admin | Lists/searches master menu items. |
| `GET` | `/api/v1/menu-items/:id` | HQ/Super admin | Gets one master menu item. |
| `PATCH` | `/api/v1/menu-items/:id` | HQ/Super admin | Updates a master menu item. |
| `DELETE` | `/api/v1/menu-items/:id` | HQ/Super admin | Deletes an unreferenced master menu item. |
| `GET` | `/api/v1/outlets` | HQ/Super admin | Lists outlets in the caller's permitted company scope. |
| `POST` | `/api/v1/outlet-menu-items` | HQ/Super admin | Assigns a master menu item to an outlet. |
| `GET` | `/api/v1/outlet-menu-items` | Authenticated | Lists outlet menu assignments; outlet users are scoped to their outlet. |
| `PATCH` | `/api/v1/outlet-menu-items/:menuItemId` | HQ/Super admin | Updates an assignment's outlet-specific price; send `outletId` and `outletPrice` in the request body. |
| `DELETE` | `/api/v1/outlet-menu-items/:menuItemId?outletId=:outletId` | HQ/Super admin | Removes an assignment; `outletId` is required as a query parameter. |

## Inventory

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/inventories` | Authenticated roles | Lists permitted outlet stock. |
| `PUT` | `/api/v1/inventories/:inventoryId` | HQ/Super admin | Sets stock quantity for an inventory record. |

## Sales and reports

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/sales` | Authenticated roles | Creates a multi-item sale; accepts optional `Idempotency-Key`. Stock deduction, receipt allocation, and sale persistence run in a database transaction. |
| `GET` | `/api/v1/sales` | Authenticated roles | Lists permitted sales with filtering and pagination. |
| `GET` | `/api/v1/sales/:id` | Authenticated roles | Returns sale details within the caller's scope. |
| `GET` | `/api/v1/reports/revenue` | Authenticated roles | Revenue totals by permitted outlet; optional `outletId`, `from`, and `to`. |
| `GET` | `/api/v1/reports/top-items` | Authenticated roles | Top-selling items; optional `outletId`, `from`, `to`, and `limit` (default 5, max 50). |

The API's role-based scopes and filters are enforced server-side. The tables
summarize the implemented routes; use Swagger for complete request and response
contracts and error cases.
