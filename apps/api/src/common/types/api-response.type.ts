import { HttpStatus } from '@nestjs/common';
import { IUnsafeObject } from './type.js';

export interface IApiError {
  message: string;
  code?: number;
  extra?: IUnsafeObject | string | (IUnsafeObject | string)[];
}

export type IApiResError = IApiError | string | null;

export interface IApiResponseMetadata extends IUnsafeObject {
  timestamp: string;
}

export interface IApiResponse<T = unknown> {
  metadata?: IApiResponseMetadata;
  error?: IApiResError;
  statusCode: HttpStatus;
  data: T;
  message: string;
  success?: boolean;
}
