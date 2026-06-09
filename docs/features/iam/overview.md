# IAM Overview

## Purpose

The Identity and Access Management (IAM) module is responsible for user identity lifecycle, secure authentication, token management, and dynamic Role-Based Access Control (RBAC). It serves as the security foundation for the entire application.

## Status

Active and Stable. Currently undergoing a migration from legacy hardcoded enum roles to dynamic database-driven RBAC.

## Priority

Critical. This module gates all access to the system.

## Dependencies

- **PostgreSQL / Prisma**: For persisting users, roles, permissions, and hashed refresh tokens.
- **Email Infrastructure** (`infrastructure/email`): For delivering password reset and email verification links.
- **Audit Logging Module** (`modules/audit`): For tracking critical security events (login, reuse detection, escalation attempts).
- **Background Workers** (`infrastructure/workers`): For periodic cleanup of expired refresh tokens.
