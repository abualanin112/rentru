# API Conventions

Conventions governing the API surface of the Notes backend.

To be documented as the project evolves. Content will be added as API patterns become established.

---

## Response Envelope

All successful API responses follow the canonical envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }   // optional
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Note not found"
  }
}
```

Stack traces included in `error.stack` only in development.

## API Versioning

- Routes mounted under `/v1` prefix.
- No formal v2 migration strategy documented yet.

## Rate Limiting

| Tier           | Limit        | Window     | Scope  |
| -------------- | ------------ | ---------- | ------ |
| Auth endpoints | 10 requests  | 15 minutes | Per IP |
| Token refresh  | 20 requests  | 15 minutes | Per IP |
| General API    | 300 requests | 15 minutes | Per IP |

## HTTP Status Conventions

- `200` — Successful read/update
- `201` — Successful creation
- `204` — Successful deletion (no content)
- `400` — Validation errors, duplicate resources
- `401` — Authentication required
- `403` — Forbidden (insufficient permissions)
- `404` — Resource not found
- `429` — Rate limit exceeded
- `500` — Internal server error (suppressed in production)

## Pagination

**Users**: Offset-based (`page`, `limit`, `sortBy`).  
**Notes**: Cursor-based (`cursor`, `limit`).

## Serialization

Response data passes through whitelist-based serializers (`*.serializer.js`) before reaching the client. Raw Prisma objects are never exposed.

---

## Changelog

### 2026-06-09

- Initial creation with confirmed response envelope, rate limits, status codes, and pagination patterns
