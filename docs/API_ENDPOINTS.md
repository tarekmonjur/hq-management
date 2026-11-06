# HQ System F&B API ENDPOINTS

## HQ API Endpoints

### Master Menu Items APIs:

`Api Base Path: /menu-items`

#### Endpoints

- `POST /` : Master menu create
- `GET /` : Master menu list
- `PATCH /:id` : Master menu update
- `DELETE /:id` : Remove unassign master menu

### Outlets APIs:

`Api Base Path: /outlets`

#### Endpoints:

- `GET /` : Company outlets list

### Assign Outlet Menu Items APIs:

`Api Base Path: /outlet-menu-items`

#### Endpoints

- `POST /` : Assign an exiting master menu item to the outlet
- `GET /` : Outlets assign menu items list
- `PATCH /menuItemId` : Update outlet price
- `DELETE /menuItemId` : Remove assignment

### Report APIs:

`Api Base Path: /reports`

#### Endpoints:

- `GET /revenue?outletId=&from=&to=` : Revenue by outlet for a date range
- `GET /top-items?outletId` : Top five items by outlet

## Inventory API Endpoints

`Api Base Path: /inventories`

- `GET /` : List inventory stock for all outlets if user role is admin else only for their outlet.
- `PUT /:inventoryId` : Inventory stock adjustment for specific inventory.

## Sales API Endpoints

`Api Base Path: /sales`

- `POST /` : Create a sale (multiple line items). Handles stock check, receipt number generation, transaction.
- `GET /` : Sales history
- `GET /:id`: Sales details

