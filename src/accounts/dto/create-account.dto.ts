import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum AccountType {
  CHECKING = 1,
  SAVINGS = 2,
}

export class CreateAccountDto {
  @ApiProperty({ description: 'Owner of the account' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({ description: 'Initial balance', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  balance?: number;

  @ApiPropertyOptional({
    description: 'Max withdrawal per day (null = unlimited)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  @Type(() => Number)
  dailyWithdrawalLimit?: number;

  @ApiProperty({ enum: AccountType, description: '1 = Checking, 2 = Savings' })
  @IsEnum(AccountType)
  @Type(() => Number)
  accountType: AccountType;
}
