-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateTable
CREATE TABLE "accounts" (
    "accountId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "dailyWithdrawalLimit" DECIMAL(15,2),
    "activeFlag" BOOLEAN NOT NULL DEFAULT true,
    "accountType" INTEGER NOT NULL,
    "createDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transactionId")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("accountId") ON DELETE RESTRICT ON UPDATE CASCADE;
