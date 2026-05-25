import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('Accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List accounts' })
  @ApiOkResponse({ description: 'Paginated list of accounts' })
  findAll(@Query() query: ListAccountsQueryDto) {
    return this.accountsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiCreatedResponse({ description: 'Account created' })
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiOkResponse({ description: 'Account details' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findOne(id);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get current balance' })
  @ApiOkResponse({ schema: { properties: { accountId: { type: 'string' }, balance: { type: 'string' } } } })
  @ApiNotFoundResponse({ description: 'Account not found' })
  getBalance(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.getBalance(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account settings (dailyWithdrawalLimit, activeFlag)' })
  @ApiOkResponse({ description: 'Account updated' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(id, dto);
  }

  @Patch(':id/block')
  @ApiOperation({ summary: 'Block an account' })
  @ApiOkResponse({ description: 'Account blocked' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  block(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.block(id);
  }

  @Patch(':id/unblock')
  @ApiOperation({ summary: 'Unblock an account' })
  @ApiOkResponse({ description: 'Account unblocked' })
  @ApiNotFoundResponse({ description: 'Account not found' })
  unblock(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.unblock(id);
  }
}
