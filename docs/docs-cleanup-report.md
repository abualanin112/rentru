# Docs Cleanup Report

This report documents the aggressive consolidation and cleanup of the `docs/` folder, executed to establish a single source of truth and remove all redundant, obsolete, and AI-generated bloat.

## Kept (ACTIVE)

The following files represent the **Single Source of Truth** and have been preserved:

- `docs/00-project/*` (4 files) - Reason: The canonical high-level architecture and project overview.
- `docs/features/iam/*` (8 files) - Reason: The canonical documentation for Identity and Access Management.
- `docs/features/notes/*` (8 files) - Reason: The canonical documentation for the Notes domain.
- `docs/features/audit/*` (8 files) - Reason: The canonical documentation for Audit Logging.
- `docs/decisions/*` (4 files) - Reason: The new authoritative Architectural Decision Records.
- `docs/PROJECT_RULES.md` - Reason: Comprehensive, up-to-date coding and architectural standards acting as the global rulebook.

---

## Merged / Moved

The following files were relocated or explicitly merged into the active structure to preserve their value while eliminating redundancy:

- **Source:** `docs/ADR/0001-use-pino-for-structured-logging.md`
  **Target:** `docs/decisions/0005-use-pino-for-structured-logging.md`
  **Reason:** Valuable existing ADR that was moved to the new canonical `decisions/` directory.

- **Source:** `docs/ADR/0002-use-testcontainers-for-integration.md`
  **Target:** `docs/decisions/0006-use-testcontainers-for-integration.md`
  **Reason:** Valuable existing ADR that was moved to the new canonical `decisions/` directory.

- **Source:** `docs/standards/*` (architecture-rules.md, best_practice.md, etc.)
  **Target:** `docs/PROJECT_RULES.md`
  **Reason:** These fragmented standard files were already fully represented within the comprehensive `PROJECT_RULES.md`. The `standards/` folder was deleted.

---

## Archived

The following files were moved to `docs/archive/`:

- `docs/rentro-core-operational-flow.md`
- `docs/rentru-product-discovery.en.md`
  - **Reason:** These documents describe a completely unrelated business domain (Rentro property rentals/bookings) rather than the "Notes API Backend". They were archived to preserve them just in case they hold historical significance or represent a pivot artifact.

---

## Deleted

The following files and folders were **permanently deleted** without hesitation:

- `docs/architecture/` (12 files) - **Reason:** AI-generated bloat. Represents redundant, outdated, or duplicated architecture summaries completely superseded by `00-project/` and `features/`.
- `docs/files/` (Contains nested folders with `.md` code mirrors) - **Reason:** Temporary AI-generated drafts (e.g., `app.js.md`) that serve no lasting documentation value.
- `docs/ADR/` (Folder & remaining scratch notes) - **Reason:** Obsolete folder after migrating the real ADRs to `decisions/`.
- `docs/infrastructure/` (`logger.md`, `prisma.md`) - **Reason:** Redundant. Logging is covered by ADR 0005, and Prisma is covered by `architecture-overview.md`.
- `docs/knowledge-base/` - **Reason:** Empty/abandoned template directory.
- `docs/modules/` (`iam.md`, `notes.md`) - **Reason:** Abandoned single-file feature descriptions completely superseded by `features/`.
- `docs/observability/logging-policy.md` - **Reason:** Redundant with `PROJECT_RULES.md` and ADR 0005.
- `docs/standards/` - **Reason:** Fully superseded by `PROJECT_RULES.md`.
- `docs/tasks/` (`backlog.md`, `current-feature.md`) - **Reason:** Temporary scratch notes. Real tasks are now tracked in `features/*/tasks.md`.
- `docs/ARCHITECTURE.md` - **Reason:** Superseded by `00-project/architecture-overview.md`.
- `docs/BUSINESS_RULES.md` - **Reason:** Superseded by `features/*/rules.md`.
- `docs/API_CONVENTIONS.md` - **Reason:** Redundant with `features/*/api.md` and `PROJECT_RULES.md`.
- `docs/DATA_STRATEGY.md` - **Reason:** Superseded by `features/*/domain.md`.
- `docs/DECISIONS_LOG.md` - **Reason:** Replaced by individual records in the `decisions/` folder.

---

## Final Documentation Structure

The `docs/` tree has been fully cleaned and now matches this pristine state:

```
docs/
├── 00-project/
│   ├── architecture-overview.md
│   ├── glossary.md
│   ├── product-roadmap.md
│   └── project-overview.md
├── archive/
│   ├── rentro-core-operational-flow.md
│   └── rentru-product-discovery.en.md
├── decisions/
│   ├── 0001-database-driven-rbac.md
│   ├── 0002-decoupled-audit-logging.md
│   ├── 0003-token-rotation-with-reuse-detection.md
│   ├── 0004-soft-deletion-deferred.md
│   ├── 0005-use-pino-for-structured-logging.md
│   └── 0006-use-testcontainers-for-integration.md
├── features/
│   ├── audit/ (8 canonical files)
│   ├── iam/ (8 canonical files)
│   └── notes/ (8 canonical files)
├── PROJECT_RULES.md
└── docs-cleanup-report.md
```
