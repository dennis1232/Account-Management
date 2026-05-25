import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionType } from '@prisma/client';
import { TransactionsController } from '../transactions.controller';
import { TransactionsService } from '../transactions.service';

const mockTx = (type: TransactionType, value: number) => ({
  transactionId: 'tx-1',
  accountId: 'uuid-1',
  value,
  type,
  transactionDate: new Date(),
});

const mockService = () => ({
  deposit: jest.fn(),
  withdraw: jest.fn(),
  getStatement: jest.fn(),
});

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    service = mockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: service },
      ],
    }).compile();

    controller = module.get(TransactionsController);
  });

  describe('POST deposit', () => {
    it('deposits and returns transaction', async () => {
      const tx = mockTx(TransactionType.DEPOSIT, 100);
      service.deposit.mockResolvedValue(tx);

      const result = await controller.deposit('uuid-1', { value: 100 }, undefined);

      expect(service.deposit).toHaveBeenCalledWith('uuid-1', { value: 100 }, undefined);
      expect(result.type).toBe(TransactionType.DEPOSIT);
    });

    it('forwards idempotency key to service', async () => {
      const tx = mockTx(TransactionType.DEPOSIT, 100);
      service.deposit.mockResolvedValue(tx);

      await controller.deposit('uuid-1', { value: 100 }, 'key-abc');

      expect(service.deposit).toHaveBeenCalledWith('uuid-1', { value: 100 }, 'key-abc');
    });

    it('propagates NotFoundException for unknown account', async () => {
      service.deposit.mockRejectedValue(new NotFoundException());
      await expect(controller.deposit('missing', { value: 100 }, undefined)).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST withdrawal', () => {
    it('withdraws and returns transaction', async () => {
      const tx = mockTx(TransactionType.WITHDRAWAL, 50);
      service.withdraw.mockResolvedValue(tx);

      const result = await controller.withdraw('uuid-1', { value: 50 }, undefined);

      expect(service.withdraw).toHaveBeenCalledWith('uuid-1', { value: 50 }, undefined);
      expect(result.type).toBe(TransactionType.WITHDRAWAL);
    });

    it('forwards idempotency key to service', async () => {
      const tx = mockTx(TransactionType.WITHDRAWAL, 50);
      service.withdraw.mockResolvedValue(tx);

      await controller.withdraw('uuid-1', { value: 50 }, 'key-xyz');

      expect(service.withdraw).toHaveBeenCalledWith('uuid-1', { value: 50 }, 'key-xyz');
    });
  });

  describe('GET statement', () => {
    it('returns paginated statement', async () => {
      const payload = {
        data: [mockTx(TransactionType.DEPOSIT, 100)],
        total: 1,
        page: 1,
        limit: 20,
      };
      service.getStatement.mockResolvedValue(payload);

      const result = await controller.getStatement('uuid-1', { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('passes period filters to service', async () => {
      service.getStatement.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await controller.getStatement('uuid-1', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        limit: 20,
      });

      expect(service.getStatement).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({ startDate: '2024-01-01', endDate: '2024-12-31' }),
      );
    });
  });
});
