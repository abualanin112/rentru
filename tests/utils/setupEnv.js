import { inject } from 'vitest';

// Retrieve the dynamic Testcontainer URL injected by globalSetup.js
const databaseUrl = inject('DATABASE_URL');

// Assign to process.env so it's available synchronously before any tests
// or application singletons (like Prisma) are imported.
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl; // Satisfy Prisma schema validation
