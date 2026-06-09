# File Documentation

File:
`src/infrastructure/config.js`

Domain:
Infrastructure / Configuration

Layer:
Process Bootstrapping

Runtime Role:
Environment variable ingestion, strict schema validation, and typed configuration export.

Dependencies:

- `dotenv`
- `zod`
- Native Node.js `path` and `url` (for ESM directory resolution)

---

# 2. PURPOSE

This file acts as the single source of truth for all environment configurations.

In enterprise environments, booting an application with missing or malformed environment variables (e.g., an invalid PostgreSQL URL) leads to cascading runtime failures that are notoriously difficult to debug. This file solves that by establishing a strict schema boundary. If the environment variables are invalid, the application intentionally crashes _before_ doing any work.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Resolves the `.env` file location relative to the module using ESM hooks.
- Loads `.env` via `dotenv` (mostly for local development).
- Parses `process.env` against a strict Zod schema.
- Throws a descriptive, fatal error immediately if validation fails.
- Re-maps flat `process.env` keys into a nested, logically grouped JavaScript object.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `zod`

Used for:

- Schema definition and runtime validation of primitive types, defaults, and coercions.

### `dotenv`

Used for:

- Developer experience (loading local text files into `process.env`).

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { config }`

The parsed, normalized, and validated configuration object.

Called by:

- Dozens of files across the project (e.g., `index.js`, `logger.js`, `prisma.js`, `router.js`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Calculates `__dirname` (which requires manual construction in ESM).
2. Instructs `dotenv` to parse the `.env` file sitting two directories up.
3. Defines a `z.object()` schema for `envVarsSchema` with strict coercions (e.g., transforming a comma-separated string into a string array for CORS).
4. Calls `safeParse(process.env)`.
5. If `.success` is false, it aggregates the exact missing/invalid keys into an Error message and throws (crashing Node.js).
6. If `.success` is true, it maps the flat Zod output into a nested dictionary (`config.prisma.url`, `config.jwt.secret`, etc.).

```mermaid
graph TD
    EnvFile[.env File] --> Dotenv[dotenv.config]
    ProcessEnv[process.env / Host OS] --> ZodSchema[Zod Validator]
    Dotenv --> ZodSchema

    ZodSchema -- Valid --> Map[Nested Mapping]
    ZodSchema -- Invalid --> Crash((Throw Error & Exit))
    Map --> Export[export { config }]
```

---

# 7. IMPORTANT CODE EXAMPLES

## Zod Schema Coercion

```javascript
    CORS_ORIGINS: z
      .string()
      .transform((str) => str.split(',').map((s) => s.trim()))
      .describe('Comma-separated list of allowed CORS origins'),
    ENABLE_BACKGROUND_WORKERS: z
      .string()
      .transform((str) => str === 'true')
      .default('false')
      .describe('Whether this node should boot background cron workers'),
```

**Why this matters:**
Environment variables are always strings. Without `Zod`, developers would be littered with `process.env.ENABLE_BACKGROUND_WORKERS === 'true'` checks across the codebase. By transforming and coercing at the boundary, the rest of the application gets guaranteed booleans and arrays.

## Fail-Fast Validation

```javascript
if (!result.success) {
  throw new Error(
    `Config validation error: ${result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
  );
}
```

**Why this matters:**
This prevents "undefined is not a function" errors deep inside a database driver. It provides immediate, actionable feedback to DevOps engineers during deployment if a required secret is missing from Kubernetes ConfigMaps or AWS SecretsManager.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/index.js`

Relationship: Uses `config.enableBackgroundWorkers` to determine whether to spawn cron jobs, and `config.port` to bind the HTTP server.

### `src/app.js`

Relationship: Uses `config.cors.origins` to lock down browser security.

---

# 9. DATABASE INTERACTIONS

None directly, but it defines the `DATABASE_URL` used by Prisma.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file handles the ingestion of critical secrets (JWT keys, SMTP passwords, DB credentials). Because it uses `z.object(...).passthrough()`, it prevents Zod from stripping out unrelated environment variables that other libraries (like AWS SDKs) might look for on `process.env`.

---

# 11. VALIDATION FLOW

This is the primary validation file for the application's infrastructure layer.

---

# 12. LOGGING & OBSERVABILITY

None. (It runs before the logger is even configured).

---

# 13. ARCHITECTURAL RISKS

### Startup Dependency

Because this file is evaluated synchronously on import, any module that imports `config.js` will trigger the validation flow. If `process.env` is not fully populated before the first `import` statement in the application, the application will crash.

---

# 14. EXTENSION POINTS

- **New Environment Variables**: Must be added to `envVarsSchema` and then mapped into the `config` object. Do not reference `process.env` directly anywhere else in the codebase.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Environment Parity: Ensures the ERP behaves predictably whether running on a developer's laptop, a CI test runner, or production servers.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
HIGH (By design, it's the configuration singleton).

Scalability:
HIGH.

Primary Concern:
None. Using Zod for environment validation is a best-in-class architectural pattern.
