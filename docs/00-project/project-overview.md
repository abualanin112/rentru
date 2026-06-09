# Project Overview

## Project Name

Notes API Backend

## Business Purpose

The Notes API Backend serves as a secure, highly-auditable modular monolith designed to manage notes with granular access controls. It provides a robust foundation for building applications that require strict data ownership, permission enforcement, and compliance tracking through comprehensive audit logging.

## Product Vision

To deliver a production-grade, extensible backend system that prioritizes security, simplicity, and modularity. The vision is to build an architecture that scales cleanly without premature microservice overhead, serving as a reliable single source of truth for user identities, access policies, and business data (notes).

## Problem Being Solved

Managing user-generated content (notes) securely requires more than just basic CRUD operations. This project solves the complexities of:

- Safely handling authentication and token lifecycles (rotation, reuse detection).
- Enforcing granular, database-driven Role-Based Access Control (RBAC) to prevent privilege escalation.
- Maintaining an immutable audit trail of all critical system mutations for compliance and debugging.

## User Types

- **Regular User**: Can register, verify their email, and manage their own notes (create, read, update, delete, archive, search).
- **Moderator** (Planned/Implicit): Can manage notes across users, based on assigned permissions.
- **Admin**: Has elevated permissions to manage other users, assign roles, and oversee the system.
- **Super Admin**: Has wildcard permissions (`*:*:*`) granting unrestricted access to all resources.

## Core Modules

The system is built as a Modular Monolith, strictly divided into explicit boundaries:

1. **IAM (Identity and Access Management)**: Handles authentication, JWT token lifecycles, user management, and dynamic RBAC permission resolution.
2. **Notes**: Handles the core business logic of note creation, tagging, archiving, cursor-based pagination, and full-text search.
3. **Audit**: Provides decoupled, system-wide event logging that survives entity deletion.

## Technical Stack

- **Language**: JavaScript (Strict Node.js ESM)
- **Runtime**: Node.js (≥18.18.0)
- **Framework**: Express.js 4.x
- **Architecture**: Modular Monolith
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6.x
- **Authentication**: Passport.js (JWT)
- **Caching**: In-memory LRU (with Redis support planned/available for infrastructure)
- **Validation**: Zod
- **Testing**: Vitest

## Current Development Stage

**Stable / Foundation Phase**. The core architectural boundaries are established. Authentication, dynamic RBAC, core Notes CRUD with full-text search, and comprehensive audit logging are fully implemented. The system operates on a single-tenant model, with active use of legacy role migration toward the new dynamic RBAC model. Soft-deletion is currently deferred.
