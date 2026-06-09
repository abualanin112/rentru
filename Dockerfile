# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/node-app

# Copy package manifests
COPY package.json package-lock.json ./

# Install ONLY production dependencies (no devDependencies like Vitest or ESLint)
RUN npm install --omit=dev --ignore-scripts


# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/node-app

# Copy package manifests and Prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including Prisma CLI for generation)
RUN npm install

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

# Copy Prisma schema and migrations (Required for deployments and runtime)
COPY --from=builder /usr/src/node-app/prisma ./prisma

# Copy application source
COPY src ./src

# Install Prisma CLI globally for production runner (Required for migrate deploy)
RUN npm install -g prisma@^6.19.3

# Secure ownership
RUN chown -R node:node /usr/src/node-app
USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
