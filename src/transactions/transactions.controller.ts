import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { DepositDto } from './dto/deposit.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('accounts/:accountId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit funds into account' })
  @ApiCreatedResponse({ description: 'Deposit recorded' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiBadRequestResponse({ description: 'Account is blocked' })
  deposit(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DepositDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.deposit(accountId, dto, idempotencyKey);
  }

  @Post('withdrawal')
  @ApiOperation({ summary: 'Withdraw funds from account' })
  @ApiCreatedResponse({ description: 'Withdrawal recorded' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiBadRequestResponse({ description: 'Account is blocked' })
  @ApiUnprocessableEntityResponse({
    description: 'Insufficient funds or daily limit exceeded',
  })
  withdraw(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: WithdrawalDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.withdraw(accountId, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'Get account statement filtered by period' })
  @ApiOkResponse({ description: 'Paginated transaction list' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  getStatement(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.transactionsService.getStatement(accountId, query);
  }
}
