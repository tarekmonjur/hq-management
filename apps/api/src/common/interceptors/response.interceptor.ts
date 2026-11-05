import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { IApiResError, IApiResponse } from './../types/api-response.type.js';
import { IUnsafeObject } from '../types/type.js';

export class ApiResponseFormat implements IApiResponse {
  metadata = {
    timestamp: new Date().toUTCString(),
  };
  statusCode: HttpStatus = HttpStatus.OK;
  success: boolean = false;
  error?: IApiResError;
  data: IUnsafeObject | null = null;
  message: string = 'Request Success';

  constructor(
    response: IApiResponse<IUnsafeObject>,
    statusCode: HttpStatus = HttpStatus.OK,
  ) {
    this.metadata = { ...this.metadata, ...response.metadata };
    this.data = response.data || (response as unknown as IUnsafeObject);
    if (response?.message) {
      this.message = response.message;
    }

    this.statusCode = response?.statusCode || statusCode;

    if (
      this.statusCode >= HttpStatus.OK &&
      this.statusCode < HttpStatus.BAD_REQUEST
    ) {
      this.success = true;
    }

    if (response?.error) {
      this.error = response.error;
    }

    if (this.data?.metadata) {
      delete this.data.metadata;
    }
  }
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<IApiResponse> {
    return next.handle().pipe(
      map((response: IApiResponse<IUnsafeObject>) => {
        const res = new ApiResponseFormat(
          response,
          context.switchToHttp().getResponse().statusCode,
        );
        context.switchToHttp().getResponse().status(res.statusCode);
        return res;
      }),
    );
  }
}
