# Glossary

This document defines core business and technical terms used throughout the Notes API Backend project to ensure a shared ubiquitous language among engineers and AI agents.

## Technical & Architectural Terms

### Modular Monolith

A software architecture pattern where the system is deployed as a single application, but the codebase is strictly segregated into logically independent modules (e.g., `iam`, `notes`, `audit`).

### Composition Root

The single place in the application where modules are wired together, dependencies are injected, and routes are registered. Located at `src/modules/router.js`.

### Barrel Pattern

A module export strategy where an `index.js` file re-exports the public API of a directory, encapsulating internal implementation details and preventing deep imports.

### Access Token

A short-lived JSON Web Token (JWT) used to authenticate API requests. It is stateless and not stored in the database.

### Refresh Token

A long-lived JWT used to obtain new Access Tokens without requiring the user to re-authenticate. It is hashed, stored in the database, and rotated on every use.

### Token Family

A group of related refresh tokens connected by a `familyId`. Used to track token lineage and revoke all connected tokens simultaneously if reuse or hijacking is detected.

### Audit Log

An immutable, append-only record of a system event. The `AuditLog` table lacks foreign key constraints to ensure the log survives even if the referenced entity is deleted.

## Business Domain Terms

### User

An individual account registered in the system, uniquely identified by an email address, capable of authenticating and owning resources.

### Role

A named collection of permissions assigned to a user. Roles define a privilege `level` to enforce a hierarchy and prevent privilege escalation.

### Permission

A granular right to perform an action on a resource. Formatted as `action:resource:scope` (e.g., `delete:notes:own`).

- **Scope (`own`)**: Restricts the action strictly to resources owned by the actor.
- **Scope (`any`)**: Allows the action on any resource across the system.

### Note

The primary business entity. A user-generated text document containing a title, content, and optional metadata like tags and archived status.

### Archive

A state of a Note indicating it is no longer actively managed but is retained for historical purposes. Achieved via a soft-archive boolean (`archived: true`).
