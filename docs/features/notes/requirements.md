# Notes Requirements

## Functional Requirements

- **Create**: Authenticated users can create notes with a title, content, and an optional array of tags.
- **Read**: Users can retrieve a specific note they own by ID.
- **List**: Users can retrieve a paginated list of their notes.
- **Search**: Users can search their notes by title and content using full-text search.
- **Filter**: Users can filter their notes by `archived` status.
- **Update**: Users can update the title, content, tags, and archived status of their notes.
- **Delete**: Users can permanently delete their notes.

## Non-Functional Requirements

- **Performance**: Listing notes must use cursor-based pagination for high performance on large datasets.
- **Search Optimization**: Full-text search must leverage native PostgreSQL text search capabilities (via Prisma preview features).
- **Data Integrity**: Notes cannot exist without an owner. The database schema must enforce `Restrict` on the owner foreign key to prevent accidental cascades bypassing the business logic hooks.
- **Auditability**: Every modification to a note must be recorded in the Audit Log.
