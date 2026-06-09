# Notes Tasks & Backlog

## Completed

- `[x]` Basic CRUD operations.
- `[x]` Database indexing for performance `[ownerId, archived, createdAt]`.
- `[x]` PostgreSQL full-text search capability.
- `[x]` Cursor-based pagination for the list endpoint.
- `[x]` IAM integration (cascading deletion via hooks).

## Planned

- `[ ]` **Soft Deletion**: Ensure Notes implement the `deletedAt` pattern alongside Users if soft-deletion is prioritized.
- `[ ]` **Note Sharing/Collaboration**: Currently constrained by `ownerId`. Introduce a `NoteCollaborator` junction table if multi-user note sharing becomes a business requirement.
