# Audit Logging API Documentation

## Internal API Only

Currently, the Audit Logging module is strictly an **internal service capability**.

There are **no exposed Express routes** (`/v1/audit`) for querying or managing audit logs via the HTTP API.

### Inter-Module Interface

Modules interact with the Audit system solely through the exported `auditService`:

```javascript
import { auditService } from '../../audit/index.js';

// Standard execution
await auditService.logEvent({
  event: 'notes.created',
  entityType: 'Note',
  entityId: note.id,
  action: 'CREATE',
  metadata: { title: note.title },
});

// Transactional execution
await auditService.logEvent(
  {
    event: 'users.deleted',
    entityType: 'User',
    entityId: user.id,
    action: 'DELETE',
  },
  prismaTransactionClient,
);
```
