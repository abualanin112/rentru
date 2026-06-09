# Notes API Documentation

## Notes Routes (`/v1/notes`)

| Method | Path       | Purpose                               | Auth Required | Required Permission         |
| ------ | ---------- | ------------------------------------- | ------------- | --------------------------- |
| POST   | `/`        | Create a new note                     | Yes           | `create:notes:own`          |
| GET    | `/`        | List/Search notes (Cursor Pagination) | Yes           | `read:notes:own`            |
| GET    | `/:noteId` | Get a specific note                   | Yes           | `read:notes:own` or `any`   |
| PATCH  | `/:noteId` | Update a note                         | Yes           | `update:notes:own` or `any` |
| DELETE | `/:noteId` | Delete a note                         | Yes           | `delete:notes:own` or `any` |

_Note: For endpoints allowing `:own` permissions, the service layer explicitly validates that the authenticated `req.user.id` matches the target `note.ownerId`._

### Pagination & Query Parameters (`GET /`)

- `search` (string): Text to search against title and content.
- `archived` (boolean): Filter by archived status.
- `sortBy` (string): Format `field:desc` or `field:asc`.
- `limit` (number): Max items per page.
- `cursor` (string): The `id` of the last item in the previous page.
