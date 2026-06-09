# Dependency Intelligence Report

This report analyzes the core architectural dependencies to evaluate lock-in, stability, and purpose.

## Core Infrastructure Dependencies

### 1. Prisma (`@prisma/client`)

- **Purpose**: Database ORM and schema migration engine.
- **Coupling Risk**: High. The data persistence layer is heavily coupled to Prisma's syntax.
- **Mitigation**: The `*.repository.js` pattern successfully isolates the Service layer from Prisma, making future replacement feasible (though migrations would remain a major effort).

### 2. Express.js (`express`)

- **Purpose**: HTTP Server Framework.
- **Coupling Risk**: Medium. Controllers and Middleware are tightly coupled.
- **Mitigation**: Services are entirely isolated from the Express `req/res` lifecycle, minimizing the blast radius if the transport layer is swapped (e.g., to Fastify).

### 3. Zod (`zod`)

- **Purpose**: Schema declaration and request payload validation.
- **Coupling Risk**: Low/Medium. Validation is isolated to middleware. Zod is industry standard and highly stable.

### 4. Pino (`pino`, `pino-http`)

- **Purpose**: High-performance structured logging.
- **Coupling Risk**: Low. Abstracted behind `src/infrastructure/logger.js`. Easily replaceable if the interface contract is maintained.

### 5. Passport.js (`passport`, `passport-jwt`)

- **Purpose**: Authentication strategy orchestration.
- **Coupling Risk**: Low/Medium. Abstracted entirely within `infrastructure/passport.js` and `auth.middleware.js`.

## Utilities & Minor Dependencies

- `helmet`, `cors`, `compression`: Standard Express security/performance middleware.
- `bcryptjs`: Synchronous/Asynchronous password hashing.
- `node-cron`: Background task scheduling (used for token cleanup).
- `nodemailer`: Email transport for verification/reset flows.
- `lru-cache`: In-memory caching, likely for RBAC permissions or rate limiting optimizations.

## Ecosystem Health

The dependency graph is exceptionally clean. There is no bloat, and no overlapping utilities (e.g., relying solely on native Node.js for dates via `dayjs` instead of heavier legacy libraries like `moment`). The project adheres to strict dependency justification.
