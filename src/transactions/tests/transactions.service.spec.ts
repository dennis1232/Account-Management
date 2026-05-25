import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionType } from '@prisma/client';
import { AccountsService } from '../../accounts/accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions.service';

const mockAccount = (overrides = {}) => ({
  accountId: 'uuid-1',
  personId: 'person-1',
  balance: 1000,
  dailyWithdrawalLimit: 500,
  activeFlag: true,
  accountType: 1,
  createDate: new Date(),
  ...overrides,
});

const mockTx = (type: TransactionType, value: number) => ({
  transactionId: 'tx-1',
  accountId: 'uuid-1',
  value,
  type,
  transactionDate: new Date(),
});

describe('TransactionsService', () => {
  let service: TransactionsService;
  let accountsService: jest.Mocked<Pick<AccountsService, 'findOne'>>;

  // Simulates the interactive tx client inside $transaction(async tx => ...)
  const txClient = {
    $queryRaw: jest.fn(),
    account: { update: jest.fn() },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AccountsService, useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(TransactionsService);
    accountsService = module.get(AccountsService);

    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation((arg) => {
      if (typeof arg === 'function') return arg(txClient);
      if (Array.isArray(arg)) return Promise.all(arg);
      return Promise.resolve(arg);
    });
  });

  describe('deposit', () => {
    it('deposits to active account', async () => {
      txClient.$queryRaw.mockResolvedValue([mockAccount()]);
      const tx = mockTx(TransactionType.DEPOSIT, 200);
      txClient.transaction.create.mockResolvedValue(tx);

      const result = await service.deposit('uuid-1', { value: 200 });

      expect(txClient.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { balance: { increment: 200 } } }),
      );
      expect(result.type).toBe(TransactionType.DEPOSIT);
    });

    it('throws NotFoundException when account not found', async () => {
      txClient.$queryRaw.mockResolvedValue([]);
      await expect(service.deposit('missing', { value: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects deposit to blocked account', async () => {
      txClient.$queryRaw.mockResolvedValue([
        mockAccount({ activeFlag: false }),
      ]);
      await expect(service.deposit('uuid-1', { value: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns cached transaction on idempotency key replay', async () => {
      txClient.$queryRaw.mockResolvedValue([mockAccount()]);
      const cached = mockTx(TransactionType.DEPOSIT, 100);
      txClient.transaction.findUnique.mockResolvedValue(cached);

      const result = await service.deposit('uuid-1', { value: 100 }, 'key-abc');

      expect(result).toEqual(cached);
      expect(txClient.account.update).not.toHaveBeenCalled();
      expect(txClient.transaction.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when idempotency key reused with different account', async () => {
      txClient.$queryRaw.mockResolvedValue([mockAccount()]);
      txClient.transaction.findUnique.mockResolvedValue(
        mockTx(TransactionType.DEPOSIT, 100),
      );

      await expect(
        service.deposit('different-account', { value: 100 }, 'key-abc'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when idempotency key reused with different operation type', async () => {
      txClient.$queryRaw.mockResolvedValue([mockAccount()]);
      txClient.transaction.findUnique.mockResolvedValue(
        mockTx(TransactionType.WITHDRAWAL, 100),
      );

      await expect(
        service.deposit('uuid-1', { value: 100 }, 'key-abc'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('withdraw', () => {
    beforeEach(() => {
      txClient.transaction.aggregate.mockResolvedValue({
        _sum: { value: '0' },
      });
    });

    it('withdraws from active account with sufficient balance', async () => {
      txClient.$queryRaw.mockResolvedValue([mockAccount()]);
      const tx = mockTx(TransactionType.WITHDRAWAL, 300);
      txClient.transaction.create.mockResolvedValue(tx);

      const result = await service.withdraw('uuid-1', { value: 300 });

      expect(txClient.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { balance: { decrement: 300 } } }),
      );
      expect(result.type).toBe(TransactionType.WITHDRAWAL);
    });

    it('throws NotFoundException when account not found', async () => {
      txClient.$queryRaw.mockResolvedValue([]);
      await expect(service.withdraw('missing', { value: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects withdrawal from blocked account', async () => {
      txClient.$queryRaw.mockResolvedValue([
        mockAccount({ activeFlag: false }),
      ]);
      await expect(service.withdraw('uuid-1', { value: 100 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects withdrawal exceeding balance', async () => {
      txClient.$queryRaw.mockResolvedValue([mockAccount({ balance: 50 })]);
      await expect(service.withdraw('uuid-1', { value: 100 })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('rejects withdrawal exceeding daily limit', async () => {
      txClient.$queryRaw.mockResolvedValue([
        mockAccount({ balance: 1000, dailyWithdrawalLimit: 500 }),
      ]);
      txClient.transaction.aggregate.mockResolvedValue({
        _sum: { value: '400' },
      });

      await expect(service.withdraw('uuid-1', { value: 200 })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('allows withdrawal when no daily limit set', async () => {
      txClient.$queryRaw.mockResolvedValue([
        mockAccount({ balance: 1000, dailyWithdrawalLimit: null }),
      ]);
      const tx = mockTx(TransactionType.WITHDRAWAL, 999);
      txClient.transaction.create.mockResolvedValue(tx);

      const result = await service.withdraw('uuid-1', { value: 999 });
      expect(result.value).toBe(999);
    });
  });

  describe('getStatement', () => {
    it('returns paginated transactions', async () => {
      accountsService.findOne.mockResolvedValue(mockAccount() as any);
      const transactions = [mockTx(TransactionType.DEPOSIT, 100)];
      prismaMock.$transaction.mockResolvedValue([transactions, 1]);

      const result = await service.getStatement('uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
    });

    it('passes date filters to Prisma findMany where clause', async () => {
      accountsService.findOne.mockResolvedValue(mockAccount() as any);
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      await service.getStatement('uuid-1', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        limit: 20,
      });

      expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transactionDate: expect.objectContaining({
              gte: new Date('2024-01-01'),
            }),
          }),
        }),
      );
    });
  });
});
