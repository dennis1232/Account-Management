import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, Max } from 'class-validator';

export class UpdateAccountDto {
  @ApiPropertyOptional({
    description: 'Max withdrawal per day (null = unlimited)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000)
  @Type(() => Number)
  dailyWithdrawalLimit?: number;
}
