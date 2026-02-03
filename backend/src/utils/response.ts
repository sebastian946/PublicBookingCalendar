import { Response } from 'express';
import type { ApiResponse, PaginationParams } from '../types/index.js';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T): void => {
  sendSuccess(res, data, 201);
};

export const sendNoContent = (res: Response): void => {
  res.status(204).send();
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  params: PaginationParams
): void => {
  const totalPages = Math.ceil(total / params.limit);

  sendSuccess(res, data, 200, {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
  });
};

export const getPaginationParams = (query: any): PaginationParams => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const sortBy = query.sortBy || 'created_at';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, sortBy, sortOrder };
};

export const getOffset = (params: PaginationParams): number => {
  return (params.page - 1) * params.limit;
};
