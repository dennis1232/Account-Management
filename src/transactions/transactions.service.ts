import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { DepositDto } from './dto/deposit.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';

type RawAccount = {
  accountId: string;
  personId: string;
  balance: string;
  dailyWithdrawalLimit: string | null;
  accountType: number;
  activeFlag: boolean;
  createDate: Date;
};

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async deposit(
    accountId: string,
    dto: DepositDto,
    idempotencyKey?: string,
  ): Promise<Transaction> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAccount(tx, accountId);

      if (idempotencyKey) {
        const cached = await this.checkIdempotency(
          tx,
          idempotencyKey,
          accountId,
          TransactionType.DEPOSIT,
        );
        if (cached) return cached;
      }

      await tx.account.update({
        where: { accountId },
        data: { balance: { increment: dto.value } },
      });

      return tx.transaction.create({
        data: {
          accountId,
          value: dto.value,
          type: TransactionType.DEPOSIT,
          idempotencyKey,
        },
      });
    });
  }

  async withdraw(
    accountId: string,
    dto: WithdrawalDto,
    idempotencyKey?: string,
  ): Promise<Transaction> {
    return this.prisma.$transaction(async (tx) => {
      const account = await this.lockAccount(tx, accountId);

      if (idempotencyKey) {
        const cached = await this.checkIdempotency(
          tx,
          idempotencyKey,
          accountId,
          TransactionType.WITHDRAWAL,
        );
        if (cached) return cached;
      }

      const balance = new Decimal(account.balance);
      const amount = new Decimal(dto.value);

      if (balance.lessThan(amount)) {
        throw new UnprocessableEntityException('Insufficient funds');
      }

      if (account.dailyWithdrawalLimit !== null) {
        await this.assertDailyLimitNotExceeded(
          tx,
          accountId,
          amount,
          account.dailyWithdrawalLimit,
        );
      }

      await tx.account.update({
        where: { accountId },
        data: { balance: { decrement: dto.value } },
      });

      return tx.transaction.create({
        data: {
          accountId,
          value: dto.value,
          type: TransactionType.WITHDRAWAL,
          idempotencyKey,
        },
      });
    });
  }

  async getStatement(
    accountId: string,
    query: StatementQueryDto,
  ): Promise<{
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.accountsService.findOne(accountId);

    const { startDate, endDate, type, page = 1, limit = 20 } = query;

    const where = {
      accountId,
      ...(type && { type }),
      ...(startDate || endDate
        ? {
            transactionDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(`${endDate}T23:59:59.999Z`) }),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async checkIdempotency(
    tx: Prisma.TransactionClient,
    key: string,
    accountId: string,
    type: TransactionType,
  ): Promise<Transaction | null> {
    const existing = await tx.transaction.findUnique({
      where: { idempotencyKey: key },
    });

    if (!existing) return null;

    if (existing.accountId !== accountId || existing.type !== type) {
      throw new ConflictException(
        'Idempotency key reused with different account or operation',
      );
    }

    return existing;
  }

  private async lockAccount(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<RawAccount> {
    const [account] = await tx.$queryRaw<RawAccount[]>`
      SELECT * FROM accounts WHERE "accountId" = ${accountId} FOR UPDATE
    `;

    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    if (!account.activeFlag)
      throw new BadRequestException('Account is blocked');

    return account;
  }

  private async assertDailyLimitNotExceeded(
    tx: Prisma.TransactionClient,
    accountId: string,
    amount: Decimal,
    dailyWithdrawalLimit: string,
  ): Promise<void> {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const result = await tx.transaction.aggregate({
      where: {
        accountId,
        type: TransactionType.WITHDRAWAL,
        transactionDate: { gte: today, lt: tomorrow },
      },
      _sum: { value: true },
    });

    const todayWithdrawn = new Decimal(result._sum.value ?? 0);
    const limit = new Decimal(dailyWithdrawalLimit);

    if (todayWithdrawn.plus(amount).greaterThan(limit)) {
      throw new UnprocessableEntityException(
        `Daily withdrawal limit of ${limit.toString()} would be exceeded. Already withdrawn today: ${todayWithdrawn.toString()}`,
      );
    }
  }
}
