# Runtime Lifecycle Documentation

## Process Bootstrap Lifecycle

When `npm start` (or `node src/index.js`) is executed, the runtime follows a strict sequence:

```mermaid
sequenceDiagram
    participant Process as Node.js Process
    participant Metrics as Telemetry & Metrics
    participant DB as PostgreSQL (Prisma)
    participant HTTP as Express Server
    participant Workers as Background Jobs

    Process->>Metrics: 0. Init Event Loop Monitor
    Process->>DB: 1. Assert DB Connectivity (SELECT 1)
    alt DB Failed
        DB-->>Process: Connection Error
        Process->>Process: process.exit(1)
    else DB Connected
        DB-->>Process: Success
        Process->>HTTP: 3. Open Listener on Port
        alt Workers Enabled
            Process->>Workers: 4. Start Token Cleanup Job
        end
    end
```

## Request Lifecycle (End-to-End)

Every incoming HTTP request flows through a predictable middleware pipeline.

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant ALS as AsyncLocalStorage (Pino)
    participant Auth as Auth Middleware
    participant Validator as Zod Middleware
    participant Controller
    participant Service
    participant DB as Prisma/PostgreSQL

    Client->>Express: HTTP Request
    Express->>ALS: Inject reqId & Child Logger
    Express->>Auth: Validate JWT (Passport)
    alt Invalid Token
        Auth-->>Client: 401 Unauthorized
    else Valid Token
        Auth->>Validator: Validate DTO (Zod)
        alt Invalid Payload
            Validator-->>Client: 400 Bad Request
        else Valid Payload
            Validator->>Controller: Route to Handler
            Controller->>Service: Call Business Logic
            Service->>DB: Execute Query
            DB-->>Service: Return Data
            Service-->>Controller: Return Result
            Controller-->>Express: Send Response
            Express-->>Client: HTTP Response
        end
    end
```

## Graceful Shutdown Lifecycle

Triggered by `SIGINT` or `SIGTERM`:

1. **Set Flag**: `global.isShuttingDown = true` (Fails new `/ready` and `/health` probes).
2. **Stop Server**: `server.close()` stops accepting new HTTP connections.
3. **Stop Cron**: Background jobs are halted.
4. **Await Workers**: Waits for active in-flight jobs to drain (max 5s timeout).
5. **Disconnect Prisma**: `prisma.$disconnect()` is called to flush DB connections safely.
6. **Exit**: Process exits cleanly.
   _(Note: A 10-second hard-kill timeout acts as a failsafe)._
