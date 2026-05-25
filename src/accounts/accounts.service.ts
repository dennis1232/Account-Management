import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Account } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListAccountsQueryDto): Promise<{ data: Account[]; total: number }> {
    const { personId, page = 1, limit = 20 } = query;
    const where = personId ? { personId } : {};
    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.account.count({ where }),
    ]);
    return { data, total };
  }

  async create(dto: CreateAccountDto): Promise<Account> {
    return this.prisma.account.create({
      data: {
        personId: dto.personId,
        balance: dto.balance ?? 0,
        dailyWithdrawalLimit: dto.dailyWithdrawalLimit ?? null,
        accountType: dto.accountType,
        activeFlag: true,
      },
    });
  }

  async findOne(accountId: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({ where: { accountId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    return account;
  }

  async getBalance(accountId: string): Promise<{ accountId: string; balance: string }> {
    const account = await this.findOne(accountId);
    return { accountId: account.accountId, balance: account.balance.toString() };
  }

  async update(accountId: string, dto: UpdateAccountDto): Promise<Account> {
    await this.findOne(accountId);
    return this.prisma.account.update({
      where: { accountId },
      data: dto,
    });
  }

  async block(accountId: string): Promise<Account> {
    const account = await this.findOne(accountId);
    if (!account.activeFlag) {
      throw new BadRequestException('Account is already blocked');
    }
    return this.prisma.account.update({
      where: { accountId },
      data: { activeFlag: false },
    });
  }

  async unblock(accountId: string): Promise<Account> {
    const account = await this.findOne(accountId);
    if (account.activeFlag) {
      throw new BadRequestException('Account is already active');
    }
    return this.prisma.account.update({
      where: { accountId },
      data: { activeFlag: true },
    });
  }
}
