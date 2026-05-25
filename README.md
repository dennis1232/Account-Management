# Account Management API

Banking REST API built with **NestJS**, **Prisma**, and **PostgreSQL**.

## Features

- Account creation, balance inquiry, block/unblock
- Deposits and withdrawals with full validation
- Daily withdrawal limit enforcement
- Transaction statement filtered by date range, type, and pagination
- Swagger UI docs
- Global exception filter with structured error responses
- Unit tests (Jest)

## Tech Stack

| Layer      | Choice                              | Reason                                                        |
| ---------- | ----------------------------------- | ------------------------------------------------------------- |
| Framework  | NestJS                              | Modular architecture, built-in DI, decorator-based validation |
| ORM        | Prisma                              | Type-safe queries, clean schema-first migrations              |
| Database   | PostgreSQL                          | ACID transactions — critical for financial operations         |
| Validation | class-validator + class-transformer | Declarative DTOs with auto-transform                          |
| Docs       | @nestjs/swagger                     | Auto-generated from decorators, zero drift                    |

## Quick Start (Docker)

```bash
git clone https://github.com/dennis1232/Account-Management.git
cd account-management-api

docker compose up --build
```

API: http://localhost:3000  
Swagger: http://localhost:3000/api/docs

> Tables are created automatically on first start via `prisma migrate deploy`.

## Local Development

### Prerequisites

- Node.js 22 ([nvm](https://github.com/nvm-sh/nvm) recommended)
- PostgreSQL 14+

### Setup

```bash
# use correct node version
nvm use

npm install

# copy and configure env
cp .env.example .env

# create tables
npx prisma migrate dev

# start with hot reload
npm run start:dev
```

### Environment Variables

| Variable       | Default                                                            | Description                  |
| -------------- | ------------------------------------------------------------------ | ---------------------------- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/account_management` | PostgreSQL connection string |
| `NODE_ENV`     | `development`                                                      | Environment                  |
| `PORT`         | `3000`                                                             | HTTP port                    |

## Running Tests

```bash
# unit tests
npm test

# watch mode
npm run test:watch

# coverage report
npm run test:cov
```

## API Reference

Full interactive docs at `/api/docs` once running.

### Accounts

| Method  | Path                    | Description                               |
| ------- | ----------------------- | ----------------------------------------- |
| `GET`   | `/accounts`             | List accounts (filterable by personId)    |
| `POST`  | `/accounts`             | Create account                            |
| `GET`   | `/accounts/:id`         | Get account details                       |
| `GET`   | `/accounts/:id/balance` | Get current balance                       |
| `PATCH` | `/accounts/:id`         | Update dailyWithdrawalLimit or activeFlag |
| `PATCH` | `/accounts/:id/block`   | Block account                             |
| `PATCH` | `/accounts/:id/unblock` | Unblock account                           |

### Transactions

| Method | Path                                    | Description            |
| ------ | --------------------------------------- | ---------------------- |
| `POST` | `/accounts/:id/transactions/deposit`    | Deposit funds          |
| `POST` | `/accounts/:id/transactions/withdrawal` | Withdraw funds         |
| `GET`  | `/accounts/:id/transactions`            | Statement (filterable) |

### Statement Query Parameters

| Param       | Type                      | Description                            |
| ----------- | ------------------------- | -------------------------------------- |
| `startDate` | ISO 8601                  | Filter from date (inclusive)           |
| `endDate`   | ISO 8601                  | Filter to date (inclusive, end of day) |
| `type`      | `DEPOSIT` \| `WITHDRAWAL` | Filter by type                         |
| `page`      | number                    | Page number (default: 1)               |
| `limit`     | number                    | Items per page, max 100 (default: 20)  |

### Example Requests

```bash
# Create a checking account with $500 daily withdrawal limit
curl -X POST http://localhost:3000/accounts \
  -H "Content-Type: application/json" \
  -d '{"personId": "person-123", "accountType": 1, "dailyWithdrawalLimit": 500}'

# Deposit $1000
curl -X POST http://localhost:3000/accounts/<id>/transactions/deposit \
  -H "Content-Type: application/json" \
  -d '{"value": 1000}'

# Withdraw $200
curl -X POST http://localhost:3000/accounts/<id>/transactions/withdrawal \
  -H "Content-Type: application/json" \
  -d '{"value": 200}'

# Statement — April 2024, deposits only
curl "http://localhost:3000/accounts/<id>/transactions?startDate=2024-04-01&endDate=2024-04-30&type=DEPOSIT&page=1&limit=20"

# Block account
curl -X PATCH http://localhost:3000/accounts/<id>/block
```

## Business Rules

- Deposits and withdrawals rejected on **blocked** accounts (`400`)
- Withdrawals fail `422` when **balance is insufficient**
- Withdrawals fail `422` when **daily limit would be exceeded** (cumulative check for current calendar day)
- All balance mutations run inside a **database transaction**
- `dailyWithdrawalLimit: null` means unlimited

## Error Responses

All errors follow a consistent structure:

```json
{
  "statusCode": 404,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/accounts/missing-id",
  "message": "Account missing-id not found"
}
```

| Code  | Meaning                                      |
| ----- | -------------------------------------------- |
| `400` | Bad request (blocked account, invalid input) |
| `404` | Account not found                            |
| `409` | Conflict (unique constraint violation)       |
| `422` | Insufficient funds or daily limit exceeded   |
| `500` | Internal server error                        |

## Project Structure

```
src/
├── accounts/
│   ├── dto/                  # CreateAccountDto, UpdateAccountDto
│   ├── tests/                # Unit + controller tests
│   ├── accounts.controller.ts
│   ├── accounts.module.ts
│   └── accounts.service.ts
├── transactions/
│   ├── dto/                  # DepositDto, WithdrawalDto, StatementQueryDto
│   ├── tests/                # Unit + controller tests
│   ├── transactions.controller.ts
│   ├── transactions.module.ts
│   └── transactions.service.ts
├── prisma/
│   ├── prisma.module.ts      # Global Prisma module
│   └── prisma.service.ts     # PrismaClient wrapper
├── common/
│   └── filters/              # AllExceptionsFilter (maps Prisma + HTTP errors)
├── app.module.ts
└── main.ts                   # Bootstrap, Swagger, global pipes/filters

prisma/
├── schema.prisma             # Account + Transaction models
└── migrations/               # SQL migration history
```
