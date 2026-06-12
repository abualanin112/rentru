# 🏢 Rentru ERP (Thoth PMS) Backend

> A secure, high-performance, and highly resilient backend system for Property Management (ERP/PMS), built with Node.js, Express, Prisma ORM, PostgreSQL, and Docker. Hardened for high-concurrency enterprise use cases with dynamic RBAC and strict data isolation.

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.18.0-blue.svg?style=flat-square)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-v4.21.2-green.svg?style=flat-square)](https://expressjs.com)
[![Prisma ORM](https://img.shields.io/badge/prisma-v6.19.3-lightblue.svg?style=flat-square)](https://prisma.io)
[![Vitest](https://img.shields.io/badge/vitest-v4.1.6-purple.svg?style=flat-square)](https://vitest.dev)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg?style=flat-square)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

This backend represents a complete, secure, and production-ready enterprise solution. It provides a robust Identity and Access Management (IAM) module, strict branch-level data isolation, passwordless authentication, and resilient audit logging.

---

## 🌟 Key Features

- **Passwordless Enterprise Authentication**:
  - Complete reliance on Google Workspace (SSO) via OAuth 2.0. No local passwords stored.
  - Invitation-only onboarding system for strict access control.
- **Strict Single Device Policy & Sessions**:
  - Passport-powered JWT access and database-backed refresh token rotation.
  - Users are strictly limited to one active device globally. Logging in from a new device instantly invalidates the previous session.
  - Instant Kill-Switch capabilities via `isActive` status for immediate operator suspension.
- **Dynamic Database-Driven RBAC**:
  - Roles and permissions are fully dynamic and managed in the database, requiring no code deployments for changes.
  - Permissions are fully resolved via direct database queries on every request.
- **Silent Guardian (Data Isolation)**:
  - Custom Prisma Client Extension that automatically injects `branchId` filters and `deletedAt: null` (Soft Delete) guards into every query.
  - Ensures robust multi-branch geographic data isolation natively at the ORM layer.
- **Resilient Audit Logging**:
  - Dedicated `AuditLog` capturing crucial system events, actor details, and deep JSON diffs (`oldValues`/`newValues`).
- **Universal Cursor Pagination Engine**:
  - Deterministic tuple-based cursor pagination (`(timestamp, id)`) for large-scale, high-concurrency transactional datasets.
  - Generates opaque Base64-encoded JSON cursors for clients and fully respects the ORM-level **Silent Guardian** branch isolation.
  - Guaranteed $O(1)$ query complexity utilizing mandatory database composite indexes.
- **Robust Global Error Handling**:
  - Centralized Express middleware stack that intercepts and standardizes JWT, database constraint violations, and schema parsing errors.
  - Natively maps all `ZodError` exceptions (thrown during request validation or manual parsing) directly to structured `400 Bad Request` payloads.
- **Distributed Background Workers**:
  - Singleton execution enforced via PostgreSQL advisory locks (`pg_try_advisory_lock`).
  - Automated session garbage collection, idle user deactivation, and expired invitation cleanup.
- **Zero-Mock Testing Environment**:
  - Highly isolated testing suite using **Vitest** and **PostgreSQL Testcontainers** to run unit and integration tests against real database instances.

---

## 🚀 Quick Start & Installation

To boot up the Rentru ERP backend locally, follow these steps:

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/notes-backend.git
cd notes-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create your local `.env` configuration:

```bash
cp .env.example .env
```

Ensure the database connection URL in `.env` points to your target PostgreSQL database. The default configuration connects to the local PostgreSQL spun up by Docker:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rentru_db?schema=public"
JWT_SECRET="your-super-secure-jwt-secret-key"

# Required Google OAuth Setup
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/v1/auth/google/callback"

# Required SMTP Email Configuration for Invitations
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USERNAME="your-gmail@gmail.com"
SMTP_PASSWORD="your-app-password"
EMAIL_FROM="support@rentru.com"

# The email of the first Super Admin
SUPER_ADMIN_EMAIL="admin@rentru.com"
```

### 4. Database Setup (Docker)

Spin up a local PostgreSQL database container:

```bash
docker run --name rentru-postgres -e POSTGRES_DB=rentru_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine
```

Synchronize the Prisma schema and apply database schema push directly:

```bash
npm run prisma:push
```

Seed the initial Super Admin account (Requires `SUPER_ADMIN_EMAIL` in `.env`):

```bash
npx prisma db seed
```

### 5. Run the Application

Start the development server with hot-reloading support:

```bash
npm run dev
```

---

## 📐 Architecture & Separation of Concerns

This project enforces a strict unidirectional flow to ensure complete decoupled components and high maintainability:

```text
       ┌──────────────┐
       │  API Client  │
       └──────┬───────┘
              │  HTTP Request
              ▼
       ┌──────────────┐
       │  API Routes  │
       └──────┬───────┘
              │  Payload Validations (Zod)
              ▼
       ┌──────────────┐
       │ Middlewares  │ ◄─── Auth, RBAC Gate, Rates, ALS Context
       └──────┬───────┘
              │  Sanitized Requests
              ▼
       ┌──────────────┐
       │ Controllers  │ ◄─── Centralized Error Handling (ApiError)
       └──────┬───────┘
              │  Isolated Operations
              ▼
       ┌──────────────┐
       │   Services   │ ◄─── Core Business Logic & DB Transactions
       └──────┬───────┘
              │  Prisma ORM
              ▼
       ┌──────────────┐
       │ Silent Guard │ ◄─── Auto-injects Branch Isolation & Soft Delete
       └──────┬───────┘
              │  Parameterized Query
              ▼
       ┌──────────────┐
       │  PostgreSQL  │
       └──────────────┘
```

### Directory Structure

```text
src/
├── app.js                          # Express app, middleware stack, health probes
├── index.js                        # Server bootstrap, lifecycle, workers init, graceful shutdown
├── infrastructure/                 # Cross-cutting infrastructure
│   ├── als.js                      # AsyncLocalStorage for branch and user context
│   ├── config.js                   # Zod-validated environment config
│   ├── logger.js                   # Pino structured logger with ALS proxy
│   ├── email/                      # Nodemailer transport for invitations
│   ├── metrics.js                  # In-process counters + periodic flush
│   ├── passport.js                 # Google OAuth + JWT Strategies
│   ├── prisma.js                   # Prisma proxy with Silent Guardian Extension
│   └── workers/                    # Distributed Cron Jobs (Session Cleanup, etc.)
├── middleware/                     # Transport-layer middleware
│   ├── auth.middleware.js          # Auth + RBAC Dynamic Gate
│   ├── error.middleware.js         # Error converter + handler
│   └── validate.middleware.js      # Zod validation execution
├── modules/                        # Business domain modules
│   ├── router.js                   # Composition root
│   ├── iam/                        # Auth, Users, Roles, Permissions, Invitations
│   └── audit/                      # Event audit logging
└── shared/                         # Stateless utilities
    ├── ApiError.js, CatchAsync.js
    ├── Paginate.js, CursorPaginate.js
    └── CursorValidator.js
```

### Documentation

Detailed project architecture and domain documentation lives in `docs/`:

| Document                            | Purpose                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `docs/features/iam/0 - overview.md` | High-level overview, Readiness Assessment, Architecture Deviations     |
| `docs/features/iam/2 - flow.md`     | Core execution flows (Login, Invite, Token Refresh, Worker Lifecycles) |
| `docs/features/iam/3 - rules.md`    | Business logic constraints, Soft-deletion, Privilege Escalation Guards |
| `docs/features/iam/4 - domain.md`   | Domain models and the finalized Prisma Schema                          |
| `docs/features/iam/5 - api.md`      | REST API Route conventions and required RBAC permissions               |
| `docs/decisions/`                   | Architectural Decision Records (ADRs) explaining technical tradeoffs   |

---

## ⚡ Available Commands

The following npm scripts are available:

| Command                   | Description                                                            |
| :------------------------ | :--------------------------------------------------------------------- |
| `npm run dev`             | Runs the app in development mode with hot-reloading (Nodemon).         |
| `npm start`               | Runs the app in production mode with PM2 daemon orchestration.         |
| `npm test`                | Runs unit and integration test suites using Vitest and Testcontainers. |
| `npm run coverage`        | Runs tests and generates test coverage report.                         |
| `npm run prisma:generate` | Generates Prisma Client artifacts.                                     |
| `npm run prisma:push`     | Synchronizes Prisma schema with database without applying migrations.  |
| `npm run prisma:seed`     | Seeds the database with the initial Super Admin account.               |

---

## 🔐 Security & Reliability Standard

- **Dynamic Token Revocation**: Secure JWT lifecycle management. A leaked refresh token used outside the concurrency grace period instantly triggers the Kill-Switch.
- **SQL Injection Defeated**: Prisma ORM guarantees query parameterization, rendering SQL injection vectors useless.
- **Privilege Escalation Prevention**: Strict runtime guards prevent users from assigning roles with privilege levels higher than their own.
- **Graceful Failover**: Process exit hooks trap OS signals (`SIGINT`/`SIGTERM`) to wait for pending requests and background workers (up to 10s), flush DB connection pools, and exit cleanly.

---

## ⚖️ License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
