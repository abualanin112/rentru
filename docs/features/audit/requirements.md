# Audit Logging Requirements

## Functional Requirements

- **Event Tracking**: Must record all critical mutations (Create, Update, Delete) on core entities (Users, Notes).
- **Security Events**: Must record authentication events (login, logout, token rotation) and security violations (token reuse, escalation attempts).
- **Context Injection**: Must capture the actor (user ID) and request correlation ID automatically.
- **Data Preservation**: Audit logs must survive the deletion of the actors or entities they reference.

## Non-Functional Requirements

- **Sanitization**: Audit metadata payloads must be aggressively sanitized to prevent leaking sensitive data (passwords, tokens) into the logs.
- **Payload Limits**: To prevent database bloat, the metadata JSON must be limited in depth, array size, and string length before insertion.
- **Transactional Atomicity**: If an audit event is triggered as part of a database transaction (e.g., User Deletion), the audit log must be written within that exact same transaction. If the transaction rolls back, the audit log must also roll back.
