# Testing Rules & Architecture

This document serves as the single source of truth for all testing-related architectural decisions. It reflects the finalized ADRs established to ensure a production-grade testing layer capable of supporting future ERP modules.

## Architectural Decision Records (ADRs)

### ADR-TST-001: Prisma Client Mocking Prohibited

- **Decision:** The use of `vi.mock('../../../../infrastructure/prisma.js')` (or equivalent) is strictly forbidden for testing any logic that queries or mutates the database.
- **Reasoning:** Mocking Prisma bypasses critical infrastructure layers, specifically the `Silent Guardian` (Prisma Extension) and `Branch Isolation` rules. Tests passing with mocked Prisma are considered "falsely passing" and provide no safety guarantees.
- **Enforcement:** All database interactions must execute against a real PostgreSQL instance via Testcontainers.

### ADR-TST-002: Infrastructure-Aware Services Require Integration Tests

- **Decision:** Any service interacting with Prisma, Transactions, Sessions, Audit, ALS (AsyncLocalStorage), or Branch Isolation must be tested exclusively via Integration Tests.
- **Reasoning:** Pure unit tests are incapable of validating the complex interplay between business logic and the underlying infrastructure.
- **Enforcement:** Service test files must reside in `tests/integration/` and use `setupTestDB()`. Pure business logic (e.g., serializers, token generators) may remain in `tests/unit/`.

### ADR-TST-003: Hybrid Fixture/Factory Strategy

- **Decision:** Static reference entities (Roles, Permissions, Branches) must use deterministic, static fixtures. Operational entities (Users, Notes, Sessions) must use dynamic factories (via `@faker-js/faker`).
- **Reasoning:** Hardcoded test data for operational entities leads to fragile tests and prevents parallel execution due to data collisions. Static reference data ensures predictable RBAC validation.
- **Enforcement:** Factories are located in `tests/factories/`. Fixtures reside in `tests/fixtures/`.

### ADR-TST-004: Mandatory Security Test Matrix

- **Decision:** Every module must implement an explicit Security Matrix Test (`*.security.test.js`).
- **Reasoning:** Business logic tests often fail to explicitly prove that vulnerabilities do not exist.
- **Coverage Requirements:**
  - SEC-001: Branch Isolation (Tenant Separation)
  - SEC-002: Insecure Direct Object Reference (IDOR)
  - SEC-003: Privilege Escalation Protection
  - SEC-004: Session Security (Invalidation, Expiration)
  - SEC-005: Input Validation & Injection Prevention
  - SEC-006: Cursor Pagination Bounds (DoS Prevention)
  - SEC-007: Audit Trail Integrity

### ADR-TST-005: Coverage Quality Over Percentage

- **Decision:** Core infrastructure files (`prisma.js`, `als.js`, `workers/**`, `passport.js`) must NOT be excluded from test coverage.
- **Reasoning:** High coverage achieved by excluding the most complex files creates a false sense of security.
- **Enforcement:** `vitest.config.js` `coverage.exclude` must not contain core infrastructure modules.

### ADR-TST-006: Parallel Test Databases Deferred

- **Decision:** `fileParallelism: false` remains enabled in `vitest.config.js` until a dedicated parallel database strategy (e.g., schema-per-worker or transaction-rollback) is implemented.
- **Reasoning:** The current Testcontainers implementation uses `TRUNCATE CASCADE` on a single global database, leading to deadlocks and data wipes when tests run concurrently.

## Mocking Policy

The following systems **MAY** be mocked:

1. **External Services/APIs:** Payment gateways, third-party integrations.
2. **Email Systems:** `email.service.js` (e.g., SendGrid/AWS SES).
3. **Time:** `vi.useFakeTimers()` for token expiration or scheduling logic.

The following systems **MUST NOT** be mocked:

1. Prisma Client & Transactions.
2. Redis/Session Cache.
3. AsyncLocalStorage (ALS).
4. Audit Logger.
