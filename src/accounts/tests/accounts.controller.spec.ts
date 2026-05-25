import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from '../accounts.controller';
import { AccountsService } from '../accounts.service';
import { AccountType } from '../dto/create-account.dto';

const mockAccount = (overrides = {}) => ({
  accountId: 'uuid-1',
  personId: 'person-1',
  balance: 1000,
  dailyWithdrawalLimit: 500,
  activeFlag: true,
  accountType: AccountType.CHECKING,
  createDate: new Date(),
  ...overrides,
});

const mockService = () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  getBalance: jest.fn(),
  update: jest.fn(),
  block: jest.fn(),
  unblock: jest.fn(),
});

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    service = mockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: service }],
    }).compile();

    controller = module.get(AccountsController);
  });

  describe('POST /accounts', () => {
    it('creates and returns account', async () => {
      const account = mockAccount();
      service.create.mockResolvedValue(account);

      const result = await controller.create({
        personId: 'person-1',
        accountType: AccountType.CHECKING,
      });

      expect(service.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(account);
    });
  });

  describe('GET /accounts/:id', () => {
    it('returns account when found', async () => {
      const account = mockAccount();
      service.findOne.mockResolvedValue(account);

      const result = await controller.findOne('uuid-1');
      expect(result).toEqual(account);
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /accounts/:id/balance', () => {
    it('returns balance object', async () => {
      service.getBalance.mockResolvedValue({ accountId: 'uuid-1', balance: 1000 });

      const result = await controller.getBalance('uuid-1');
      expect(result).toEqual({ accountId: 'uuid-1', balance: 1000 });
    });
  });

  describe('PATCH /accounts/:id/block', () => {
    it('blocks account', async () => {
      const blocked = mockAccount({ activeFlag: false });
      service.block.mockResolvedValue(blocked);

      const result = await controller.block('uuid-1');
      expect(result.activeFlag).toBe(false);
    });
  });

  describe('PATCH /accounts/:id/unblock', () => {
    it('unblocks account', async () => {
      const active = mockAccount({ activeFlag: true });
      service.unblock.mockResolvedValue(active);

      const result = await controller.unblock('uuid-1');
      expect(result.activeFlag).toBe(true);
    });
  });
});
