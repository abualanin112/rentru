# ADR 0007: Background Tasks, Workers, and Queues Architecture

Date: 2026-06-12

## Status

Accepted & Implemented

## Context

As the backend infrastructure for the MVP was designed, we evaluated the necessity of standard background processing components such as task queues (e.g., BullMQ, Celery) and external worker services. These systems add operational complexity, database resources (e.g., Redis), and increased deployment costs. We needed a pragmatic approach tailored to the MVP scale while ensuring non-blocking operations and time-based automation.

## Decisions

### 1. Queues and External Workers: Excluded

- **Rationale**: Distributed queues (like BullMQ/Celery backed by Redis) are designed to throttle and distribute heavy workloads under high concurrency. For the current MVP load, even with concurrent admin actions, the Express.js server can easily handle standard request/response cycles.
- **Decision**: Exclude dedicated external queues and separate worker processes from the MVP architecture to save hosting costs, simplify local setups, and ease maintenance.

### 2. Background Tasks: In-Process Asynchronous "Fire and Forget"

- **Rationale**: Operations like sending invitation/verification emails or rendering PDF documents should not block the HTTP response path or increase latency for the end-user.
- **Decision**: Implement non-blocking asynchronous JavaScript functions within the main application process. By invoking these tasks as Promises without `await`ing them inside the response handler (e.g., wrapping them in a safe `.then().catch()` wrapper), Node.js executes them asynchronously on the event loop. This is sufficient for our current scale.

### 3. Scheduled Tasks (Cron Jobs): Embedded node-cron with Distributed Locks

- **Rationale**: Time-based operations—such as daily session purges, auto-deactivating inactive accounts, or updating reservation/unit statuses—are critical. However, spinning up a dedicated cron microservice is unnecessary.
- **Decision**: Embed `node-cron` directly within the Express application process. To run scheduled tasks safely in a multi-instance (replicated) environment without duplicate execution, use PostgreSQL Advisory Locks (`pg_try_advisory_lock`) as a synchronization mechanism.

## Consequences

- **Positive**: Reduced infrastructure costs (no need for dedicated worker servers or additional Redis instances for queues).
- **Positive**: Minimal setup overhead; developers can run the entire system locally with just Node.js and PostgreSQL.
- **Positive**: Native Node.js async event loop capabilities are fully utilized.
- **Negative**: Long-running or heavy CPU-bound tasks (e.g., massive image processing) could block the event loop if not offloaded. (Mitigation: Not expected in current requirements; can be scaled to a dedicated microservice/worker in future phases if needed).
- **Negative**: If a process crashes mid-execution of an un-awaited background Promise, the task is lost. (Mitigation: Critical database state updates are transaction-bound, and email dispatch failures are logged).
