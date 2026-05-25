-- Add idempotencyKey to transactions
ALTER TABLE "transactions" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- Drop old idempotency_keys table
DROP TABLE IF EXISTS "idempotency_keys";
