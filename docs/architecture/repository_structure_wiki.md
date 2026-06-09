# Repository Structure Wiki

## Macro Organization

The repository uses a clear separation between source code (`src/`), database configuration (`prisma/`), and operational configuration (`docker-compose*.yml`).

### `/src` (Core Application)

The root of the Node.js source code.

#### `/src/modules/`

**Purpose**: Contains the core business domains (Bounded Contexts).
**Architecture**: Each folder here is an isolated module.

- `iam/`: Identity & Access Management. Owns Users, Roles, Permissions, Auth flows.
- `notes/`: The core product domain. Owns Notes logic.
- `audit/`: The auditing domain. Owns the immutable audit log.
- `router.js`: The Composition Root. Aggregates all module routes and wires cross-domain events (e.g., cascading deletions).

#### `/src/infrastructure/`

**Purpose**: Encapsulates all third-party and I/O concerns.
**Architecture**: Modules in `src/modules` depend on this layer, but this layer does NOT depend on business modules.

- `prisma.js`: Database client initialization.
- `logger.js`: Pino instance with `AsyncLocalStorage` correlation.
- `passport.js`: Authentication strategies.
- `config.js`: Centralized environment variable parsing.
- `workers/`: Background job definitions.

#### `/src/middleware/`

**Purpose**: Global, transport-level Express middleware.

- `auth.middleware.js`: Auth enforcement.
- `error.middleware.js`: Global error interception and formatting.
- `validate.middleware.js`: Zod schema enforcement.
- `pino-http.middleware.js`: Request logging injection.

#### `/src/shared/`

**Purpose**: Stateless, domain-agnostic utilities.

- `ApiError.js`: Standardized error payload.
- `Paginate.js`: Pagination utilities.
- `CatchAsync.js`: Async route wrapper to prevent unhandled rejections.

### `/prisma` (Database Tier)

- `schema.prisma`: The single source of truth for the database schema.
- `migrations/`: Prisma migration history.
- `seed.js`: Initial data population script.

### Operational Roots

- `app.js`: Express app construction, middleware pipeline setup, and probe (`/health`, `/ready`) definitions.
- `index.js`: Process entrypoint, bootstrap orchestration, and graceful shutdown handling.
