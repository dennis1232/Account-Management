import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'Resource already exists (unique constraint violation)',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Foreign key constraint failed',
  },
  P2000: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Input value too long for field',
  },
  P2014: { status: HttpStatus.BAD_REQUEST, message: 'Relation violation' },
  P1001: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Database unreachable',
  },
  P1002: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Database connection timed out',
  },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        status = mapped.status;
        message = mapped.message;
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database error';
        this.logger.error(
          `Unhandled Prisma error ${exception.code}`,
          exception,
        );
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection error';
      this.logger.error(exception);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data sent to database';
      this.logger.error(exception);
    } else {
      this.logger.error(exception);
    }

    response.status(status).json({
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === 'string' ? { message } : message),
      statusCode: status,
    });
  }
}
