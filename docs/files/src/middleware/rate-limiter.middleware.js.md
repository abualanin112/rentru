# File Documentation

File:
`src/middleware/rate-limiter.middleware.js`

Domain:
Cross-Cutting Concerns / Security

Layer:
Transport Middleware

Runtime Role:
Defines in-memory rate limiting boundaries to protect the API against brute-force attacks and volumetric DDoS.

Dependencies:

- `express-rate-limit`

---

# 2. PURPOSE

Exposing an API directly to the internet invites abuse. Attackers will attempt to brute-force passwords, scrape data, or simply overwhelm the server with requests.

This file establishes strict quotas on how many times a single IP address can hit specific routes within a 15-minute window. It divides the strategy into granular buckets: incredibly strict limits for Authentication, moderate limits for Token Refresh, and generous limits for standard API consumption.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Instantiates multiple `express-rate-limit` instances.
- Tracks request counts per IP address using an in-memory store.
- Blocks requests (returning `429 Too Many Requests`) once the limit is breached.
- Configures conditional skipping (e.g., ignoring successful logins in the rate limit calculation to exclusively penalize failed brute-force attempts).

---

# 4. IMPORT ANALYSIS

## Important Imports

### `express-rate-limit`

Used for:

- Standardized IP-based rate limiting.
  Coupling Level: HIGH.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { authLimiter, refreshLimiter, apiLimiter }`

`authLimiter`: Strict (10 req/15min). Used for Login/Register.
`refreshLimiter`: Moderate (20 req/15min). Used for token rotation.
`apiLimiter`: High (300 req/15min). Used globally on `/v1`.

Called by:

- `src/app.js` (Mounts `apiLimiter`).
- `src/modules/router.js` (Injects `authLimiter`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Middleware intercepts the request.
2. Identifies the client IP (relying on `app.set('trust proxy', 1)` configured in `app.js`).
3. Checks the IP against the current 15-minute window memory map.
4. If the count exceeds `max`, responds with HTTP `429` immediately, bypassing controllers.
5. If under `max`, increments the counter and calls `next()`.
6. For `authLimiter`, if the request succeeds (e.g., successful login), the counter is decremented/skipped due to `skipSuccessfulRequests: true`.

---

# 7. IMPORTANT CODE EXAMPLES

## Strict Auth Limiter

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 requests / 15 minutes for strict login/register
  skipSuccessfulRequests: true,
});
```

**Why this matters:**
`skipSuccessfulRequests: true` is a crucial UX optimization. If a legitimate user logs in and out 15 times, they won't be blocked. However, if a bot tries 10 incorrect passwords in a row, they are locked out for 15 minutes. This heavily penalizes attackers while remaining invisible to standard users.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/app.js`

Responsibility: Application configuration.
Relationship: `app.use('/v1', apiLimiter)` ensures that _all_ traffic, regardless of the route, is subjected to a baseline limit of 300 requests per 15 minutes.

### `src/modules/iam/routes/auth.route.js`

Responsibility: Auth routing.
Relationship: The `authLimiter` is applied explicitly to `/login` and `/register` endpoints.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Defends against:

- Brute Force Attacks.
- Credential Stuffing.
- Basic volumetric application-layer DDoS.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

`express-rate-limit` sets specific headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) which are observable by the client.

---

# 13. ARCHITECTURAL RISKS

### In-Memory State

By default, `express-rate-limit` stores IP counters in Node.js memory. In a distributed deployment (e.g., 5 pods behind a load balancer), an attacker can hit the API 5 times more than the limit simply by being round-robined to different pods.
To be effective in a clustered environment, this must be backed by Redis.

### NAT / Shared IPs

Because limiting is purely IP-based, if 100 legitimate users are operating behind a corporate NAT firewall (sharing one public IP), the `apiLimiter` (300 req/15min) will block the entire office very quickly.

---

# 14. EXTENSION POINTS

- **Redis Integration**: To fix the architectural risk, the `store` property should be overridden with `rate-limit-redis` connected to the application's cache infrastructure.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Infrastructure Cost Management: Prevents bots from consuming expensive compute and database resources.
- Security: Protects tenant data from brute-force infiltration.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
LOW (In-memory store is not suitable for multi-node deployments).

Primary Concern:
The lack of a Redis store for the rate limiter makes it ineffective and potentially harmful (NAT blocking) in a horizontally scaled enterprise environment.
