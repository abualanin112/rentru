# ERP Domain Map

The repository is structured into distinct bounded contexts (Domains) operating under a Modular Monolith architecture.

## Bounded Contexts

### 1. Identity & Access Management (IAM)

- **Responsibilities**: User registration, authentication, session management (tokens), role-based access control (RBAC).
- **Core Entities**: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Token`.
- **Integrations**: Provides Auth hooks for all other domains. Emits user deletion events to trigger cascades in other domains.

### 2. Product Domain (Notes)

- **Responsibilities**: Core business logic for entity creation, retrieval, and management.
- **Core Entities**: `Note`.
- **Integrations**: Listens to IAM deletion events to scrub orphaned user data (`deleteManyByOwnerId`).

### 3. Auditing Domain (Audit)

- **Responsibilities**: Immutable tracking of critical system events.
- **Core Entities**: `AuditLog`.
- **Integrations**: Intentionally decoupled. Uses soft references (`actorId`, `entityId`) without hard DB foreign keys to ensure logs survive entity deletion.

## Domain Communication Graph

```mermaid
graph TD
    subgraph IAM [IAM Domain]
        U(User)
        R(Role)
        P(Permission)
        T(Token)
    end

    subgraph Notes [Notes Domain]
        N(Note)
    end

    subgraph Audit [Audit Domain]
        AL(AuditLog)
    end

    %% Internal Domain Relationships
    U -->|Has| T
    U -->|Assigned| R
    R -->|Grants| P

    %% Cross-Domain Relationships
    N -->|Owned By (Restrict FK)| U
    AL -.->|Soft Ref: actorId| U
    AL -.->|Soft Ref: entityId| N

    %% Event Flows
    IAM -- "User Deleted Event" --> Notes
```

## Boundaries & Coupling

- **Database Level**: The `Note` table has a hard Foreign Key to `User` (`ownerId`), but `onDelete: Restrict` prevents accidental cascading. Deletions are orchestrated in code.
- **Code Level**: The Composition Root (`router.js`) acts as the event bus, linking `userService.registerUserDeletionHook` to `notesService.deleteManyByOwnerId`. This prevents cyclic dependency imports between the domains.
