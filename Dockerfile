# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/node-app

# Copy package manifests
COPY package.json package-lock.json ./

# Install ONLY production dependencies (no devDependencies like Vitest or ESLint)
RUN npm ci --omit=dev


# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/node-app

# Copy package manifests and Prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including Prisma CLI for generation)
RUN npm ci

# Copy full application source
COPY . .

# Explicitly generate Prisma Client binaries matching Alpine architecture
RUN npx prisma generate


# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /usr/src/node-app

ENV NODE_ENV=production

# Copy strictly required manifests
COPY package.json package-lock.json ./

# Copy lightweight production modules
COPY --from=deps /usr/src/node-app/node_modules ./node_modules

# Inject the explicitly generated Prisma Client binaries into the production modules
COPY --from=builder /usr/src/node-app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/node-app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy application source
COPY src ./src

# Secure ownership
RUN chown -R node:node /usr/src/node-app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/ready').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"]

# استبدل السطر الأخير بهذا السطر
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
