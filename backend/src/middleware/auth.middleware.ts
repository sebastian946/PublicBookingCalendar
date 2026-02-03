import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { AuthenticatedRequest, UserRole, User } from '../types/index.js';

interface JWTPayload {
  id: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  iat: number;
  exp: number;
}

/**
 * Middleware de autenticación - valida JWT y carga usuario
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    // Verificar token
    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw new UnauthorizedError('Invalid token');
    }

    // Validar que el usuario pertenece al tenant del request
    if (req.tenant && payload.tenant_id !== req.tenant.id && payload.role !== 'super_admin') {
      throw new ForbiddenError('User does not belong to this tenant');
    }

    // Verificar que el usuario existe y está activo
    const user = await db.queryOne<User>(
      `SELECT id, email, role, tenant_id, is_active FROM users WHERE id = $1`,
      [payload.id]
    );

    if (!user || !user.is_active) {
      throw new UnauthorizedError('User not found or inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware opcional de autenticación - no falla si no hay token
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  await authMiddleware(req, res, next);
};

/**
 * Middleware para requerir roles específicos
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`Role ${req.user.role} is not authorized for this action`);
    }

    next();
  };
};

/**
 * Middleware para super admin solamente
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Middleware para admins del tenant (tenant_admin o super_admin)
 */
export const requireTenantAdmin = requireRole('super_admin', 'tenant_admin');

/**
 * Middleware para staff o superior
 */
export const requireStaff = requireRole('super_admin', 'tenant_admin', 'staff');

/**
 * Genera tokens JWT
 */
export const generateTokens = (user: Pick<User, 'id' | 'email' | 'role' | 'tenant_id'>) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

/**
 * Verifica refresh token
 */
export const verifyRefreshToken = (token: string): { id: string } => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
};
