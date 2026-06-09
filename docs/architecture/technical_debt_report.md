# Technical Debt Report

## Critical Debt

### 1. Incomplete RBAC Migration

- **Issue**: The `User` model in `schema.prisma` retains the `@deprecated` `LegacyRole` field. The system is currently in a transitional state between hardcoded enum roles and the dynamic junction-table RBAC system.
- **Risk**: Dual sources of truth for authorization. If some middleware checks `User.role` while other middleware checks `UserRole`, security bypasses or unpredictable access blocks will occur.
- **Action Required**: Finalize data migration from `LegacyRole` to `UserRole` and remove the enum from the database schema entirely.

## Medium Debt

### 1. Monolithic Cron Execution

- **Issue**: `node-cron` is embedded directly into the Node.js process (e.g., `token-cleanup.worker.js` started in `index.js`).
- **Risk**: In a horizontally scaled environment (multiple Node.js instances), cron jobs will trigger simultaneously across all replicas, leading to race conditions and unnecessary database load.
- **Action Required**: Migrate background tasks to a distributed queue (e.g., BullMQ with Redis) to ensure exactly-once execution across a cluster, or dedicate a single worker node for crons.

### 2. Secret Management

- **Issue**: Reliance solely on `.env` parsing via `dotenv` and `infrastructure/config.js`.
- **Risk**: As the system scales toward ERP status, managing raw strings for JWT secrets and DB credentials becomes a compliance risk.
- **Action Required**: Integrate a robust secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) or utilize Kubernetes secrets mounted at runtime.

## Low Debt

### 1. Hardcoded Pagination Defaults

- **Issue**: Based on the presence of `Paginate.js`, pagination defaults are likely hardcoded globally.
- **Risk**: Different domains (Notes vs Audit Logs) have drastically different read scales.
- **Action Required**: Ensure the pagination utility allows granular, per-repository override of maximum page sizes to prevent DoS via massive queries.
