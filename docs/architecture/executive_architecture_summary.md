# Executive Architecture Summary

## System Overview

This system is a **Modular Monolith** built on Node.js (ESM), Express.js, and PostgreSQL (via Prisma). It serves as a production-grade backend API, currently functioning as a secure Notes management system with Identity & Access Management (IAM) and Audit capabilities. The architecture is explicitly designed for maintainability, strict module boundaries, and future enterprise extensibility.

## Architectural Style

The repository implements a **Pragmatic Modular Monolith**:

- **Domain Decomposition**: Code is organized by domain bounded contexts (`iam`, `notes`, `audit`) rather than technical layers.
- **Strict Boundaries**: Modules communicate strictly through exposed public APIs in their respective `index.js` files. Cross-domain repository or controller imports are strictly prohibited.
- **Centralized Orchestration**: A central router (`src/modules/router.js`) mounts all module routes. `app.js` is kept clean and only mounts infrastructure-level middleware.
- **Flat Structure**: Deep nesting is avoided. Inside domains, files use feature-suffix naming (e.g., `note.controller.js`, `note.service.js`).

## Core Technology Stack

- **Runtime**: Node.js >= 18 (ESM Strict)
- **Framework**: Express.js
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: Passport.js (JWT Strategy)
- **Validation**: Zod
- **Observability**: Pino (Structured Logging with Request Correlation via AsyncLocalStorage)
- **Testing**: Vitest with Testcontainers

## Runtime Model

The application bootstraps through a strict initialization sequence:

1. Validates PostgreSQL connectivity.
2. Initializes background workers (if enabled).
3. Opens the HTTP listener.
4. Uses Express middleware pipelines for request correlation (`reqId`), rate-limiting, and payload validation.
5. Employs a robust, reverse-order graceful shutdown process to drain connections and prevent data loss.

## Enterprise Architecture Readiness

While currently managing a `notes` domain, the system exhibits ERP-grade architectural patterns:

- **RBAC**: A dynamic Role-Based Access Control system with granular permissions (`action:resource:scope`).
- **Audit Logging**: Immutable, decoupled audit trails that survive entity deletion.
- **Multitenancy Foundation**: The RBAC and Audit systems lay the groundwork for multi-tenant isolation.
- **Resilience**: Liveness, readiness, and health probes for Kubernetes/Docker orchestrators.
