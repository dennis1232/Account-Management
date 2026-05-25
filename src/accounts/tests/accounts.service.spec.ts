import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts.service';
import { PrismaService } from '../../prisma/prisma.service';

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

const mockPrisma = () => ({
  account: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
});

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AccountsService);
  });

  describe('findAll', () => {
    it('returns paginated accounts', async () => {
      const accounts = [mockAccount()];
      prisma.account.findMany.mockResolvedValue(accounts);
      prisma.account.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(accounts);
      expect(result.total).toBe(1);
    });

    it('filters by personId when provided', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      prisma.account.count.mockResolvedValue(0);

      await service.findAll({ personId: 'person-1', page: 1, limit: 20 });

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { personId: 'person-1' } }),
      );
    });
  });

  describe('create', () => {
    it('creates account with defaults', async () => {
      const account = mockAccount();
      prisma.account.create.mockResolvedValue(account);

      const result = await service.create({ personId: 'person-1', accountType: 1 });

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ personId: 'person-1', activeFlag: true }) }),
      );
      expect(result).toEqual(account);
    });
  });

  describe('findOne', () => {
    it('returns account when found', async () => {
      const account = mockAccount();
      prisma.account.findUnique.mockResolvedValue(account);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(account);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBalance', () => {
    it('returns balance as exact string to preserve Decimal precision', async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount({ balance: { toString: () => '1234.56' } }));

      const result = await service.getBalance('uuid-1');
      expect(result).toEqual({ accountId: 'uuid-1', balance: '1234.56' });
    });
  });

  describe('block', () => {
    it('blocks an active account', async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount());
      prisma.account.update.mockResolvedValue(mockAccount({ activeFlag: false }));

      const result = await service.block('uuid-1');
      expect(result.activeFlag).toBe(false);
    });

    it('throws when already blocked', async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount({ activeFlag: false }));
      await expect(service.block('uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unblock', () => {
    it('unblocks a blocked account', async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount({ activeFlag: false }));
      prisma.account.update.mockResolvedValue(mockAccount({ activeFlag: true }));

      const result = await service.unblock('uuid-1');
      expect(result.activeFlag).toBe(true);
    });

    it('throws when already active', async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount());
      await expect(service.unblock('uuid-1')).rejects.toThrow(BadRequestException);
    });
  });
});
