import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

function IsAfterOrEqual(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isAfterOrEqual',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedProp] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedProp
          ];
          if (!value || !relatedValue) return true;
          return new Date(value as string) >= new Date(relatedValue as string);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be on or after ${args.constraints[0] as string}`;
        },
      },
    });
  };
}

export class StatementQueryDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601, inclusive, interpreted as end-of-day UTC)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  @IsAfterOrEqual('startDate', {
    message: 'endDate must be on or after startDate',
  })
  endDate?: string;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Filter by transaction type',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
