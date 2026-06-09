# IAM API Documentation

## Authentication Routes (`/v1/auth`)

| Method | Path                       | Purpose                         | Auth Required   |
| ------ | -------------------------- | ------------------------------- | --------------- |
| POST   | `/register`                | Register a new user             | No              |
| POST   | `/login`                   | Authenticate and obtain tokens  | No              |
| POST   | `/logout`                  | Invalidate a refresh token      | No (Uses Token) |
| POST   | `/refresh-tokens`          | Obtain new access/refresh pair  | No (Uses Token) |
| POST   | `/forgot-password`         | Request password reset email    | No              |
| POST   | `/reset-password`          | Complete password reset         | No (Uses Token) |
| POST   | `/send-verification-email` | Request email verification link | Yes             |
| POST   | `/verify-email`            | Complete email verification     | No (Uses Token) |

## User Management Routes (`/v1/users`)

| Method | Path       | Purpose             | Auth Required | Required Permission         |
| ------ | ---------- | ------------------- | ------------- | --------------------------- |
| POST   | `/`        | Create user (Admin) | Yes           | `create:users:any`          |
| GET    | `/`        | List all users      | Yes           | `read:users:any`            |
| GET    | `/:userId` | Get specific user   | Yes           | `read:users:own` or `any`   |
| PATCH  | `/:userId` | Update user profile | Yes           | `update:users:own` or `any` |
| DELETE | `/:userId` | Delete user account | Yes           | `delete:users:own` or `any` |

_Note: For endpoints allowing `:own` permissions, the service layer validates that the authenticated `req.user.id` matches the target `userId`._
