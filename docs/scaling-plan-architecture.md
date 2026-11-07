# System Scaling Plan & Architectural Evolution

> **Target Scenario**: 10 Outlets, ~100,000 Transactions/Month (~3,300 tx/day; peak ~15-20 req/s during lunch/dinner rush).  
> **Current Stack**: Modular Monolith (NestJS API + TypeORM, Next.js Web App, Single PostgreSQL Instance).

---

## 1. System Scale Assessment & Evolution

### Workload Sizing
- **100,000 transactions/month** is roughly **~3,300 orders/day**, which translates to a steady-state rate of **< 1-2 write queries per second**.
- Even with a **10x meal-time peak**, the write load is approximately **15–25 transactions/second**.
- **Architectural Verdict**: A well-tuned, single-instance relational database (e.g., PostgreSQL on AWS RDS or DigitalOcean Managed DB) can easily handle thousands of transactions per second. Complex strategies like multi-master database sharding or NoSQL migrations are **premature optimizations** at this scale.

```
                    ┌───────────────────────────┐
                    │  Internet / Cloudflare    │
                    └─────────────┬─────────────┘
                                  │ HTTPS
                    ┌─────────────▼─────────────┐
                    │   Application Load Balancer│
                    └──────┬─────────────┬──────┘
                           │             │
              ┌────────────▼──┐       ┌──▼────────────┐
              │ API Container 1│       │ API Container 2│  (Stateless Node.js/NestJS)
              └────────────┬──┘       └──┬────────────┘
                           │             │
                           │   PgBouncer │ (Connection Pooling)
                           └──────┬──────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    PostgreSQL Primary     │ (Writes, Critical Reads)
                    └─────────────┬─────────────┘
                                  │ Async Streaming
                    ┌─────────────▼─────────────┐
                    │   PostgreSQL Read Replica │ (Heavy Reports & Analytics)
                    └───────────────────────────┘
```

---

## 2. Technical Scaling Pillars

### A. Database Scaling Strategy
1. **Vertical Sizing & Hardware**:
   - 4 vCPUs, 16 GB RAM with NVMe SSD (AWS `db.m6g.xlarge` or DigitalOcean 16GB DB) provides more than enough IOPS and memory for the entire working dataset.
2. **Connection Pooling**:
   - Node.js instances recreate database connections rapidly under burst traffic. Deploy **PgBouncer** (transaction pooling) between NestJS and Postgres to cap active server connections under ~100 while servicing hundreds of app threads.
3. **Indexing & Concurrency Safety**:
   - Existing composite indexes: `(outlet_id, created_at)` for sales, `(outlet_id, is_active)` for menus, and `(outlet_id, menu_item_id)` for inventory.
   - Maintain atomic database transactions for sale checkout: `SELECT ... FOR UPDATE` on inventory and atomic receipt numbering (`MAX(receipt_no) + 1` scoped to outlet).
4. **Read/Write Separation**:
   - Provision **one read replica** with asynchronous replication. Route reporting and read-only catalog traffic to the replica; keep write operations (checkout, inventory updates) on the primary.

---

### B. Reporting Performance Considerations
1. **Bounded Queries & Pagination**:
   - Enforce server-side pagination (`limit <= 100`) and date range bounds on all reporting APIs (`from` / `to`).
2. **Incremental Rollups / Materialized Aggregations**:
   - As transaction logs accumulate beyond millions of rows, ad-hoc `SUM()` / `GROUP BY` across `sale_items` becomes slow.
   - Maintain an asynchronous daily rollup table:
     ```sql
     CREATE TABLE daily_outlet_revenue_summary (
       outlet_id UUID,
       summary_date DATE,
       total_revenue NUMERIC(12, 2),
       total_orders INT,
       PRIMARY KEY (outlet_id, summary_date)
     );
     ```
   - Rollups are refreshed via a midnight cron job or PostgreSQL Materialized View (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).
3. **Application Caching**:
   - Cache static master catalogs and daily finalized revenue aggregates in **Redis** with TTLs and tag-based invalidations.

---

### C. Infrastructure & Cloud Deployment
1. **Stateless Web & API Containers**:
   - Deploy API and Web apps inside Docker containers orchestrated via **AWS ECS** or **DigitalOcean App Platform / Kubernetes**.
   - Horizontal Pod Autoscaler (HPA) configured to scale based on CPU (>70%) or HTTP request count.
2. **Secrets & Networking**:
   - Strict VPC isolation: Postgres and Redis live in private subnets with no public internet ingress.
   - Centralized secrets management (AWS Secrets Manager or Vault). Store secrets in the hosting platform's secret manager/environment settings, not in source control or container images. 
3. **Observability**:
   - Structured JSON logging (Pino) shipped to centralized collectors (Datadog, Grafana Loki, ELK Stack or CloudWatch).
   - Add centralized structured logs, request/trace correlation, error rates, latency and saturation dashboards, alerting, and uptime/health checks.
   - Trace latency bottlenecks using OpenTelemetry / APM.

---

## 3. Microservices Evolution Strategy

At 10 outlets, a **Modular Monolith** is vastly superior in operational simplicity, developer velocity, and ACID transaction safety. However, if business growth demands independent scaling, deployment cadences, or multi-team ownership, the system can cleanly decompose into **Domain-Driven Microservices**.

```
                   ┌──────────────────────────────────┐
                   │    API Gateway / Reverse Proxy   │
                   └─┬──────────────┬───────────────┬─┘
                     │              │               │
       ┌─────────────▼──┐    ┌──────▼──────┐   ┌───▼────────────┐
       │ Orders & POS   │    │ Inventory   │   │ Catalog & Menu │
       │ Service        │    │ Service     │   │ Service        │
       └───────┬────────┘    └──────┬──────┘   └───┬────────────┘
               │                    │              │
               │ Events/Queue (RabbitMQ / Kafka / BullMQ)   │
               └────────────────────┬──────────────┘
                                    │
                       ┌────────────▼───────────┐
                       │ Reporting & Analytics  │
                       │ Service (Read Store)   │
                       └────────────────────────┘
```

### Component Breakdown & Extraction Order:

| Service | Responsibility | Why Separate? | Trade-offs & Coupling |
| :--- | :--- | :--- | :--- |
| **1. Reporting & Analytics** | Sales aggregation, daily audits, top selling items, business BI. | **First to decouple**. Read-heavy, complex analytical queries can degrade checkout performance. | Accepts slight eventual consistency (seconds/minutes delay). Does not affect checkout transactions. |
| **2. Catalog & Menu** | Master items, categories, pricing overrides, outlet assignments. | Low write volume, massive read volume. Can be cached at edge or redis or replica. | Must broadcast `PriceUpdated` / `MenuItemAssigned` events to other domains. |
| **3. Orders / Sales & POS** | POS / Cashier checkout, order / sales lifecycles, payment status, receipts. | Core business revenue driver. Potentially high write and Requires high availability and zero downtime. | Today stock deduction and receipt allocation are atomic with sale creation. Loses immediate ACID joins with Inventory. Extraction requires Saga / Two-Phase reservation workflows. |
| **4. Inventory Service** | Stock tracking, stock audits, low-stock alerts, waste logs. | Independent inventory lifecycle (purchase orders, warehouse transfers). | Needs resilient asynchronous event processing (`OrderCompleted` -> deduct stock). |
| **5. Identity Service** | Authentication, sessions, users, roles and tenant membership | Separate it to centralize identity management in one service with a clear source of truth for authorization. | Adds network dependency and token/permission contract complexity; retain a clear source of truth for authorization. |

### Distributed Consistency Patterns:
- **Transactional Outbox Pattern**: Store the order and its SaleCreated event in the same database transaction using an outbox table; a relay then publishes the event to RabbitMQ, Kafka, or BullMQ, avoiding the database-and-broker dual-write problem.
- **Saga Pattern**: Manage distributed transactions (e.g. Order Creation -> Inventory Deduction -> Payment Capture) with compensating transactions in case of failure.

- **Redis-Based Distributed Shared Memory Pattern (Recommanded for POS):**  To achieve sub-millisecond checkout speeds in a POS system, The system keeps stock data in Redis memory to validate purchases in less than a millisecond. Redis checks and updates stock when a sale starts. Its atomic operation helps prevent two cashiers from selling the same available stock. If stock is available, the POS can confirm the sale and print the receipt. BullMQ then processes the sale and saves it to the database in the background. The system should also handle queue or database failures so confirmed sales are not lost.

---

## 4. Offline POS & Kitchen Display System (KDS) Strategy

In a restaurant or retail setting, internet outages must **never stop orders from being taken or food from being prepared**.

```
  OUTLET LOCAL AREA NETWORK (LAN)                     HQ CLOUD
┌───────────────────────────────────────────┐       ┌────────────────────────┐
│                                           │       │                        │
│   ┌───────────────┐     ┌─────────────┐   │       │   ┌────────────────┐   │
│   │ POS Terminal 1│     │ KDS Screen  │   │       │   │  NestJS Cloud  │   │
│   └───────┬───────┘     └──────▲──────┘   │       │   │      API       │   │
│           │ WebSocket / mDNS   │          │       │   └────────▲───────┘   │
│           ▼                    │          │       │            │           │
│   ┌────────────────────────────┴──────┐   │       │            │           │
│   │ Outlet Edge Gateway / Mini-Server │   │ HTTPS │            │           │
│   │ (Local SQLite / PostgreSQL + LAN) ├───┼───────┼────────────┘           │
│   │ - Local Order Queue & Storage     │   │ Batch │ (Sync when internet    │
│   │ - Local Receipt Allocation        │   │ Sync  │  reconnects)           │
│   └───────────────────────────────────┘   │       │                        │
│                                           │       │                        │
└───────────────────────────────────────────┘       └────────────────────────┘
```

### A. Local POS & KDS Continuity (LAN Architecture)
1. **Outlet Local Gateway (Edge Server)**:
   - Run a lightweight edge server (a mini PC, Raspberry Pi, or the primary POS station) on the local WiFi/LAN running a embedded database (SQLite or localized PostgreSQL).
2. **Local POS ↔ KDS Communication**:
   - Terminals discovery is automated over LAN via **mDNS/Bonjour**.
   - POS terminals publish orders directly to the Local Edge Server via **WebSockets / gRPC**.
   - The KDS screen maintains a persistent local WebSocket connection to the Local Edge Server. Orders appear on kitchen screens in **< 50 milliseconds**, completely independent of external internet.
3. **Local Catalog Snapshot**:
   - Each POS terminal caches menu items, prices, taxes, and discounts locally in browser IndexedDB or SQLite.

---

### B. Offline Sync Protocol on Internet Reconnection
1. **Durable Local Queue**:
   - Offline transactions are marked with `sync_status = 'PENDING'` and persisted to disk with a cryptographically secure client-generated UUID and an `Idempotency-Key` (e.g., `outlet_id:device_id:order_uuid`).
2. **Batch Sync with Exponential Backoff**:
   - A background sync worker continuously detects cloud health (`HEAD /api/v1/health`).
   - On reconnect, pending orders are synced in sequential batches (`POST /api/v1/sales/sync-batch`).
3. **Idempotent Cloud Processing**:
   - The cloud database enforces a unique constraint on `(outlet_id, idempotency_key)`.
   - If the network drops mid-sync and the client retries, the server safely detects existing records and returns `200 OK` without creating duplicate sales or deducting duplicate inventory.
4. **Offline Receipt & Sequential Counter Resolution**:
   - Cloud receipt numbers are sequential per outlet. Offline terminals issue provisional local numbers (e.g. `OFFLINE-T1-1042`).
   - Upon sync, the cloud assigns the authoritative master fiscal receipt number, which is updated on the cloud dashboard and synced back to terminal records.
5. **Inventory Conflict Management**:
   - Two terminals might sell the last bottle of an item offline.
   - Strategy: The cloud **accepts the sale as authoritative** (never lose money), deducts the stock, allows temporary negative inventory if needed, and triggers a `"Stock Discrepancy / Oversell Review"` alert for the outlet manager.

