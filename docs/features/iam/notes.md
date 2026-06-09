# IAM Notes

## Open Questions

- **Role Assignment**: Who initially assigns the `Super Admin` role upon first deployment? Is there a seed script or an initial bootstrap flow?
- **Email Delivery**: The SMTP config is required to boot, but what happens if the SMTP server goes down during runtime? Do we queue emails or drop them? (Implementation check: `email.service.js` currently catches and logs errors, swallowing them so the HTTP response isn't blocked).

## Technical Debt

- **Legacy Enum**: The `LegacyRole` enum on the `User` model must be formally dropped from the database schema once the dynamic RBAC migration is verified across all environments.
- **Cache Invalidation**: The current 5-minute LRU cache for permissions relies on a global version counter for schema-wide invalidation. This is effective but crude. Migrating to Redis Pub/Sub for targeted cache invalidation would be more performant.

## Assumptions

- We assume that token compromise is highly localized. The 2-second grace period for token reuse relies on the assumption that valid concurrent requests (like multiple frontend async calls) resolve quickly.
