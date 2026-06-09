# Project Documentation & Knowledge Base

Welcome to the central documentation index for the Modular Monolith backend.

During the latest architectural convergence, our documentation was flattened and reorganized to be more accessible, maintainable, and aligned with the actual project structure.

---

## 1. Standards & Guidelines

This section contains the non-negotiable rules for contributing to the repository.

- **[Architecture Rules](../standards/architecture-rules.md)**: Details the Modular Monolith boundaries, infrastructure encapsulation, and module isolation rules.
- **[Naming Conventions](../standards/naming-conventions.md)**: Strict naming conventions for all files, including services, repositories, controllers, and middlewares.
- **[Import Rules](../standards/import-rules.md)**: Rules regarding strict ESM imports, barrel files (`index.js`), and cross-module boundaries.
- **[Testing Standards](../standards/testing-standards.md)**: Guidelines for writing unit, integration, and e2e tests using Vitest and Testcontainers.

## 2. Architecture & Security

- **[Enterprise Security Standards](../architecture/security.md)**: Details on authentication (JWT + rotating refresh tokens), rate limiting, and threat protocol mechanisms.

## 3. Modules (Business Domains)

Each bounded context (module) has its own documentation detailing its internal flows and responsibilities.

- **[IAM Module](../modules/iam.md)**: Identity and Access Management, including User registration, Auth flows, and dynamic RBAC.
- **[Notes Module](../modules/notes.md)**: The core note-taking domain logic and aggregate rules.

## 4. Infrastructure & Observability

- **[Prisma Infrastructure](../infrastructure/prisma.md)**: Guidelines on Prisma client initialization, transaction handling, and schema synchronization.
- **[Logger Infrastructure](../infrastructure/logger.md)**: Setup and usage of the Pino structured logger.
- **[Logging Policy](../observability/logging-policy.md)**: Event taxonomy, redaction rules, and observability standards.

## 5. Architectural Decision Records (ADR)

Historical logs of major architectural decisions.

- **[ADR Index](../ADR/README.md)**
- **[ADR 0001: Structured Logging](../ADR/0001-use-pino-for-structured-logging.md)**
- **[ADR 0002: Testcontainers Integration](../ADR/0002-use-testcontainers-for-integration.md)**

---

## Future Roadmap

The system is designed to support long-term evolution from a monolithic application into a larger enterprise platform:

1. **Current Core Monolith**: Notes Aggregates, Dynamic RBAC, In-Memory Caching, Testcontainers Integration.
2. **Modular Monolith Decomposition**: Strict bounded contexts and shared kernel interfaces.
3. **ERP Modules**: Future integration of workflows, accounting, and approvals.
4. **Multi-Tenant Scale**: Database sharding, partitioning, and read-replicas.
