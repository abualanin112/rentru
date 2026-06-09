# File Documentation

File:
`src/middleware/pino-http.middleware.js`

Domain:
Cross-Cutting Concerns / Observability

Layer:
Transport Middleware

Runtime Role:
HTTP access logging middleware that automatically generates correlation IDs, tracks request durations, and enforces HTTP header redaction before writing to the log stream.

Dependencies:

- `pino-http`
- Native Node.js `crypto`
- `baseLogger` from `src/infrastructure/logger.js`

---

# 2. PURPOSE

While `logger.js` handles explicit `logger.info("foo")` calls throughout the code, a robust API also needs automatic "access logs" for every incoming HTTP request.

This middleware bridges Express and Pino. It ensures that every request starts with a unique ID, tracks the latency of the entire request lifecycle, and outputs a final, structured JSON log containing the method, URL, status code, and duration, without requiring developers to log this manually in their controllers.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Generates a unique correlation ID (UUID v4) for every incoming request if one was not provided in headers.
- Extracts `req.user.id` (if the request successfully passed authentication) and attaches it to the custom properties of the log.
- Normalizes success and error messages.
- Pre-processes the Express `req` object through a custom serializer to explicitly redact highly sensitive HTTP headers (`Authorization`, `Cookie`) before passing the object to Pino's internal engine.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `pino-http`

Used for:

- The core middleware implementation linking Express to Pino.
  Coupling Level: HIGH.

### `crypto`

Used for:

- High-performance, cryptographically secure UUID generation for `reqId`.

### `baseLogger`

Used for:

- Sinking the HTTP logs into the primary application log stream.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { pinoMiddleware as pinoHttp }`

The instantiated Express middleware.

Called by:

- `src/app.js` (mounted very high in the middleware stack, before any routing).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Request hits the Express application.
2. `pinoHttp` intercepts the request.
3. `genReqId` fires, assigning a `crypto.randomUUID()` to the request.
4. Pino starts an internal performance timer.
5. The request passes down the middleware chain, controllers, and services.
6. The response is sent to the client.
7. Pino finishes the timer and triggers its `serializers`.
8. The `req` serializer deep-clones the headers to avoid mutating the live object, and censors `Authorization` and `Cookie`.
9. `customProps` runs, pulling the `userId` off the `req.user` object (which was populated downstream by `auth.middleware.js`).
10. The final structured JSON access log is emitted to stdout.

---

# 7. IMPORTANT CODE EXAMPLES

## Header Redaction Strategy

```javascript
req: (req) => {
  const serialized = pinoHttp.stdSerializers.req(req);
  if (serialized.headers) {
    serialized.headers = { ...serialized.headers };
    if (serialized.headers.authorization) {
      serialized.headers.authorization = '[REDACTED]';
    }
    if (serialized.headers.cookie) {
      serialized.headers.cookie = '[REDACTED]';
    }
  }
  return serialized;
},
```

**Why this matters:**
Even though `logger.js` has a global `redact` configuration, `pino-http` can sometimes bypass those rules depending on how the `req` object is serialized. By explicitly cloning and scrubbing the headers here, it provides defense-in-depth against leaking JWTs into centralized logging platforms.

## UUID Generation

```javascript
genReqId(req) {
  return req.id || crypto.randomUUID();
},
```

**Why this matters:**
This initializes the distributed trace. If an upstream load balancer (like AWS ALB or Nginx) provides a `req.id` (usually via `X-Request-Id`), it preserves it. Otherwise, it guarantees a UUID is available for the `AsyncLocalStorage` context to pick up.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/app.js`

Responsibility: Pipeline configuration.
Relationship: Injects this middleware immediately after basic health probes.

### `src/middleware/error.middleware.js`

Responsibility: Error handling.
Relationship: The error middleware attaches `res.err`, which `pino-http` picks up via `pinoHttp.stdSerializers.err` to log the stack trace.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents header leakage. Does not enforce authorization.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

This is a pure observability file.

---

# 13. ARCHITECTURAL RISKS

### Shallow Cloning in Serializer

The line `serialized.headers = { ...serialized.headers };` performs a shallow clone. While headers in Express are typically flat objects, if any library mutates a header into a nested object, the redaction logic might inadvertently mutate the original request or fail to redact deeply.

---

# 14. EXTENSION POINTS

- **Custom Logging Formats**: If Datadog requires specific keys (e.g., `http.method` instead of `req.method`), the `customProps` function can be used to remap fields dynamically.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Security Auditability: Provides an immutable log of exactly what APIs were called, when, and how long they took.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH (Standard Pino performance).

Primary Concern:
None. Clean and standard implementation.
