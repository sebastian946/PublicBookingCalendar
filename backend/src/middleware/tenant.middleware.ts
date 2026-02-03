import { Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { cache } from '../config/redis.js';
import type { AuthenticatedRequest, Tenant } from '../types/index.js';

const TENANT_CACHE_TTL = 300; // 5 minutes

/**
 * Middleware para resolver el tenant desde:
 * 1. Subdomain (clinic.booking-saas.com)
 * 2. Header X-Tenant-ID
 * 3. Query param ?tenant=slug
 */
export const tenantMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let tenantSlug: string | null = null;

    // 1. Intentar desde subdomain
    const host = req.hostname || req.get('host') || '';
    const subdomain = extractSubdomain(host);
    if (subdomain) {
      tenantSlug = subdomain;
    }

    // 2. Intentar desde header
    if (!tenantSlug) {
      const headerTenant = req.get('X-Tenant-ID');
      if (headerTenant) {
        tenantSlug = headerTenant;
      }
    }

    // 3. Intentar desde query param
    if (!tenantSlug && req.query.tenant) {
      tenantSlug = req.query.tenant as string;
    }

    // Si no hay tenant, continuar sin contexto de tenant (rutas públicas/super admin)
    if (!tenantSlug) {
      next();
      return;
    }

    // Buscar tenant en cache
    const cacheKey = `tenant:${tenantSlug}`;
    let tenant = await cache.get<Tenant>(cacheKey);

    // Si no está en cache, buscar en DB
    if (!tenant) {
      tenant = await db.queryOne<Tenant>(
        `SELECT * FROM tenants WHERE slug = $1 AND is_active = true`,
        [tenantSlug]
      );

      if (tenant) {
        await cache.set(cacheKey, tenant, TENANT_CACHE_TTL);
      }
    }

    if (!tenant) {
      throw new NotFoundError('Tenant');
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware que REQUIERE un tenant válido
 */
export const requireTenant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.tenant) {
    throw new NotFoundError('Tenant');
  }
  next();
};

/**
 * Extrae el subdomain del host
 * Ejemplos:
 *   clinic.booking-saas.com -> clinic
 *   api.clinic.booking-saas.com -> clinic
 *   localhost:3001 -> null
 *   booking-saas.com -> null
 */
function extractSubdomain(host: string): string | null {
  // Remover puerto
  const hostname = host.split(':')[0];

  // Localhost no tiene subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  const parts = hostname.split('.');

  // Necesitamos al menos 3 partes (subdomain.domain.tld)
  if (parts.length < 3) {
    return null;
  }

  // Si empieza con 'api' o 'www', tomar la siguiente parte
  if (parts[0] === 'api' || parts[0] === 'www') {
    return parts.length > 3 ? parts[1] : null;
  }

  return parts[0];
}

/**
 * Invalidar cache del tenant
 */
export const invalidateTenantCache = async (slug: string): Promise<void> => {
  await cache.del(`tenant:${slug}`);
};
