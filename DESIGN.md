# Design Document — Account Management API

## Overview

NestJS + PostgreSQL (Prisma) REST API for managing bank accounts and transactions. Two modules: `Accounts` and `Transactions`.

---

## Data Model

```
Account
  accountId            UUID (PK)
  personId             String
  balance              Decimal(15,2)
  dailyWithdrawalLimit Decimal(15,2)?
  activeFlag           Boolean
  accountType          Int
  createDate           DateTime

Transaction
  transactionId   UUID (PK)
  accountId       UUID (FK → Account)
  value           Decimal(15,2)
  type            DEPOSIT | WITHDRAWAL
  transactionDate DateTime
  idempotencyKey  String? (UNIQUE)
```

---

## Correctness

Every write runs inside a database transaction with a row-level lock:

```sql
SELECT * FROM accounts WHERE "accountId" = $1 FOR UPDATE
```

Mutations execute atomically: lock → read state → validate → persist → commit, with automatic rollback on failure. Lock releases when transaction commits or rolls back — no manual unlock.

---

## Concurrency

`deposit` and `withdraw` both acquire `FOR UPDATE` on the account row before any mutation. While one request holds the lock, concurrent requests on the same account wait. Once the first transaction commits, the next request sees the updated balance — prevents double-spend and race conditions.

---

## Idempotency

`idempotency-key` header is optional on deposit and withdrawal. When provided:

1. **Fast path** — if key already exists in `transactions`, return original result immediately.
2. **Conflict guard** — if key exists but `accountId` or `type` differ, throw `409 Conflict`. A deposit key cannot be replayed as a withdrawal.

The `idempotencyKey` column has a `UNIQUE` constraint. Two concurrent requests with the same key: one `INSERT` wins, the other hits the constraint. Both return the same result.

---

## Domain Rules

**Withdrawal validation** (in order, inside the lock):
1. Account must exist → `404`
2. Account must be active → `400`
3. Balance ≥ amount → `422 Insufficient funds`
4. If `dailyWithdrawalLimit` set: today's withdrawals + amount ≤ limit → `422 Daily limit exceeded`

**Daily limit** is computed from `transactionDate >= UTC midnight today`.

**Deposit** has no balance validation — only account existence and active status.

**Amount constraints** (DTO level): positive, max 2 decimal places, max `1,000,000` per transaction.

---

## API

```
Accounts
  GET    /accounts                   list (paginated, filter by personId)
  POST   /accounts                   create
  GET    /accounts/:id               get by ID
  GET    /accounts/:id/balance       get balance
  PATCH  /accounts/:id               update (dailyWithdrawalLimit, activeFlag)
  PATCH  /accounts/:id/block         set activeFlag = false
  PATCH  /accounts/:id/unblock       set activeFlag = true

Transactions
  POST   /accounts/:accountId/transactions/deposit     deposit
  POST   /accounts/:accountId/transactions/withdrawal  withdraw
  GET    /accounts/:accountId/transactions             statement (paginated, filter by date range + type)
```

---

## Testing

Unit tests cover: happy paths, `400`/`404`/`409`/`422` domain errors, idempotency fast path, daily limit boundary, blocked account guard.

---

## Scale

**10x** — Add PgBouncer for connection pooling. Queues requests during spikes, prevents connection exhaustion.

**100x** — Shard accounts by `personId` across multiple databases. Add a queue (e.g. SQS) to absorb write bursts safely.

---

## Trade-offs

**Synchronous HTTP over async queue** — client gets an immediate result. Async would make sense if operations were slow or needed to be queued under spike load.

**Idempotency key is optional** — callers that don't supply a key on retries risk duplicate transactions. Making it required would be safer but more opinionated.

---

## Known Gaps

**No request body hash validation** — if a client reuses an idempotency key with a different `value`, the server returns the original result silently instead of rejecting with `422`. Fix: store `requestBodyHash` on `Transaction`, compare on replay, throw if mismatch.

**No authentication** — all endpoints are open. Should add JWT/API key guard before production.

**Balance not cached** — `GET /balance` hits the DB every time. For read-heavy workloads, cache in Redis with a short TTL and invalidate on every write.
