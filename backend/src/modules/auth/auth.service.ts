import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db } from '../../config/database.js';
import { generateTokens, verifyRefreshToken } from '../../middleware/auth.middleware.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../utils/errors.js';
import type { User, Tenant, TenantSettings } from '../../types/index.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';

const SALT_ROUNDS = 12;

const defaultTenantSettings: TenantSettings = {
  timezone: 'America/New_York',
  currency: 'USD',
  locale: 'en-US',
  booking_advance_days: 30,
  cancellation_hours: 24,
  reminder_hours: [24, 1],
  payment_required: false,
  allow_virtual_visits: true,
};

export class AuthService {
  /**
   * Registra un nuevo tenant con su admin
   */
  async register(input: RegisterInput) {
    // Verificar si el slug ya existe
    const existingTenant = await db.queryOne<Tenant>(
      'SELECT id FROM tenants WHERE slug = $1',
      [input.tenantSlug]
    );

    if (existingTenant) {
      throw new ConflictError('Tenant slug already exists');
    }

    // Verificar si el email ya existe
    const existingUser = await db.queryOne<User>(
      'SELECT id FROM users WHERE email = $1',
      [input.email.toLowerCase()]
    );

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Crear tenant y admin en una transacción
    const result = await db.transaction(async (client) => {
      // Crear tenant
      const tenantId = uuid();
      const tenant = await client.query<Tenant>(
        `INSERT INTO tenants (id, name, slug, subdomain, settings, subscription_plan, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'free', true, NOW(), NOW())
         RETURNING *`,
        [tenantId, input.tenantName, input.tenantSlug, input.tenantSlug, JSON.stringify(defaultTenantSettings)]
      );

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

      // Crear admin user
      const userId = uuid();
      const user = await client.query<User>(
        `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'tenant_admin', $5, $6, $7, true, false, NOW(), NOW())
         RETURNING id, email, role, tenant_id, first_name, last_name`,
        [userId, tenantId, input.email.toLowerCase(), passwordHash, input.firstName, input.lastName, input.phone || null]
      );

      return {
        tenant: tenant.rows[0],
        user: user.rows[0],
      };
    });

    // Generar tokens
    const tokens = generateTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      tenant_id: result.user.tenant_id,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      ...tokens,
    };
  }

  /**
   * Login de usuario
   */
  async login(input: LoginInput, tenantId?: string) {
    // Buscar usuario
    let query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const params: any[] = [input.email.toLowerCase()];

    if (tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    const user = await db.queryOne<User>(query, params);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(input.password, user.password_hash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Actualizar last_login_at
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generar tokens
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    });

    // Obtener tenant
    const tenant = await db.queryOne<Tenant>(
      'SELECT id, name, slug FROM tenants WHERE id = $1',
      [user.tenant_id]
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      } : null,
      ...tokens,
    };
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string) {
    const { id } = verifyRefreshToken(refreshToken);

    const user = await db.queryOne<User>(
      'SELECT id, email, role, tenant_id FROM users WHERE id = $1 AND is_active = true',
      [id]
    );

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return generateTokens(user);
  }

  /**
   * Obtener perfil del usuario actual
   */
  async getProfile(userId: string) {
    const user = await db.queryOne<User>(
      `SELECT id, email, role, first_name, last_name, phone, avatar_url, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: user.role,
      createdAt: user.created_at,
    };
  }

  /**
   * Cambiar contraseña
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await db.queryOne<User>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    return { success: true };
  }
}

export const authService = new AuthService();
