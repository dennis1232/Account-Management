export const TransactionType = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export class PrismaClient {
  $connect = jest.fn();
  $disconnect = jest.fn();
  $transaction = jest.fn();
  account = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };
  transaction = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  };
}
