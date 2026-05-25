import { BadRequestException, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AccountsModule } from './accounts/accounts.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccountsModule,
    TransactionsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const first = errors[0];
          const message = first.constraints
            ? Object.values(first.constraints)[0]
            : 'Validation failed';
          return new BadRequestException({ error: 'VALIDATION_ERROR', message });
        },
      }),
    },
  ],
})
export class AppModule {}
