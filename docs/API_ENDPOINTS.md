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

## Outlets API Endpoints

`Api Base Path: /outlets/:outletId`

- `GET /menu-items` : Return only assign items for that outlet.
- `GET /inventory` : List current inventory stock for that outlet.
- `PUT /inventory/:menuItemId` : Inventory stock adjustment
- `POST /sales` : Create a sale (multiple line items). Handles stock check, receipt number generation, transaction.
- `GET /sales` : Sales history
- `GET /sales/:id`: Sales details
