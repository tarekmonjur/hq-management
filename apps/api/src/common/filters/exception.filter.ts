import {
  ArgumentsHost,
  Catch,
  ExceptionFilter as NestExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { IApiError, IApiResponse } from './../types/api-response.type.js';
import { HandleHttpException } from './http-exception.filter.js';

@Catch()
export class ExceptionFilter implements NestExceptionFilter {
  private readonly logger = new Logger(ExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): Response {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status =
      response.statusCode >= HttpStatus.BAD_REQUEST
        ? response.statusCode
        : HttpStatus.INTERNAL_SERVER_ERROR;
    let error: IApiError = { code: status, message: 'Internal Server Error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = HandleHttpException(exception);
    }

    const statusText = HttpStatus[status];
    const fallbackMessage =
      typeof error.message === 'string' ? error.message : 'Internal Server Error';

    const resp: IApiResponse = {
      metadata: {
        timestamp: new Date().toUTCString(),
        path: request.url,
      },
      statusCode: status,
      error,
      data: null,
      message: (statusText || fallbackMessage).replaceAll(/-|_/g, ' '),
      success: false,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception, exception?.stack);
    } else {
      this.logger.warn(exception);
    }

    return response.status(status).json(resp);
  }
}
