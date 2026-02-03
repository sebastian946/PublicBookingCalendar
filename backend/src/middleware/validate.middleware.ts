import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Middleware de validación con Zod
 */
export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));
        throw new ValidationError('Validation failed', details);
      }
      throw error;
    }
  };
};

/**
 * Valida múltiples targets a la vez
 */
export const validateMultiple = (schemas: Partial<Record<ValidationTarget, ZodSchema>>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    for (const [target, schema] of Object.entries(schemas)) {
      try {
        const data = req[target as ValidationTarget];
        const validated = schema.parse(data);
        req[target as ValidationTarget] = validated;
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((e) => ({
              field: `${target}.${e.path.join('.')}`,
              message: e.message,
              code: e.code,
            }))
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
};
