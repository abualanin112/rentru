# Notes Rules

Extract of confirmed business rules governing the Notes domain.

## Access Rules

- **Authentication**: All note operations require a valid access token.
- **Ownership**: By default, users can only access and modify notes where `ownerId` matches their `userId`.
- **Admin Override**: Administrators with the `:any` scope (e.g., `update:notes:any`) can modify notes owned by other users.

## Data Constraints

- **Title Length**: Maximum 200 characters (enforced via `VARCHAR(200)` and Zod validation).
- **Default State**: New notes default to `archived: false`.
- **Tags**: Represented as an array of strings. Defaults to an empty array `[]`.

## Deletion Constraints

- **Database Protection**: The `Note` table foreign key to `User` has `onDelete: Restrict`. This prevents accidental ORM cascading. All note deletion logic must explicitly flow through the application layer hooks so that side-effects (like Audit Logging, if extended to bulk operations) can be processed.
