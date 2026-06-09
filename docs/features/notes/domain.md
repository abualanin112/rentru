# Notes Domain

## Entities

### Note

The primary data document representing a user's content.

- **Fields**:
  - `id`: Primary key (cuid).
  - `title`: String (`VARCHAR(200)`).
  - `content`: String (`TEXT`).
  - `archived`: Boolean (default `false`). Represents a soft-archive state (hidden from default views).
  - `tags`: Array of Strings (default `[]`). Used for categorization.
  - `ownerId`: Foreign key to `User`.
  - `createdAt`: Timestamp.
  - `updatedAt`: Timestamp.

- **Indexes**:
  - `[ownerId]`
  - `[ownerId, archived]`
  - `[ownerId, archived, createdAt]`
    These indexes are specifically tuned for the application's most frequent query patterns (fetching lists of unarchived notes for a specific user, sorted by creation date).

## Entity Map

```
User (1) ---- (M) Note
```
