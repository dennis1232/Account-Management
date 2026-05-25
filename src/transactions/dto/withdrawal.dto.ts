import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, Max } from 'class-validator';

export class WithdrawalDto {
  @ApiProperty({ description: 'Amount to withdraw', example: 50.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  @Type(() => Number)
  value: number;
}
