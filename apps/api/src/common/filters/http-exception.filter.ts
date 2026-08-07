import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any = {
      code: 'SERVER_ERROR',
      message: 'An internal server error occurred',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        if (res.error && res.error.code) {
          errorResponse = res.error;
        } else if (res.message) {
          errorResponse = {
            code: res.code || (status === 409 ? 'SLOT_UNAVAILABLE' : status === 404 ? 'NOT_FOUND' : status === 400 ? 'INVALID_INPUT' : 'BAD_REQUEST'),
            message: Array.isArray(res.message) ? res.message.join(', ') : res.message,
          };
        }
      } else if (typeof res === 'string') {
        errorResponse.message = res;
      }
    } else if (exception && (exception as any).code === 'P2002') {
      // Catch Prisma PostgreSQL Unique Constraint Violation
      status = HttpStatus.CONFLICT;
      errorResponse = {
        code: 'SLOT_UNAVAILABLE',
        message: 'This slot was just booked by another patient.',
      };
    } else if (exception instanceof Error) {
      errorResponse.message = exception.message;
    }

    return response.status(status).json({
      success: false,
      error: errorResponse,
    });
  }
}
