import { Router } from 'express';
import { authMiddleware, requireTenantAdmin } from '../../middleware/auth.middleware.js';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../../config/database.js';
import { sendSuccess, sendCreated, sendPaginated, getPaginationParams, getOffset } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest, Professional, User } from '../../types/index.js';

const router = Router();

const createProfessionalSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  specialization: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

const updateProfessionalSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  specialization: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  is_active: z.boolean().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

router.use(authMiddleware, requireTenant);

// GET /api/professionals - List professionals
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const params = getPaginationParams(req.query);
  const offset = getOffset(params);
  const tenantId = req.tenant!.id;

  const professionals = await db.query<Professional & { first_name: string; last_name: string; email: string }>(
    `SELECT p.*, u.first_name, u.last_name, u.email, u.phone
     FROM professionals p
     JOIN users u ON p.user_id = u.id
     WHERE p.tenant_id = $1 AND p.is_active = true
     ORDER BY u.first_name ${params.sortOrder}
     LIMIT $2 OFFSET $3`,
    [tenantId, params.limit, offset]
  );

  const countResult = await db.queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM professionals WHERE tenant_id = $1 AND is_active = true',
    [tenantId]
  );

  sendPaginated(res, professionals, parseInt(countResult?.count || '0'), params);
}));

// GET /api/professionals/:id - Get professional
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const professional = await db.queryOne<Professional & { first_name: string; last_name: string; email: string }>(
    `SELECT p.*, u.first_name, u.last_name, u.email, u.phone
     FROM professionals p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [req.params.id, req.tenant!.id]
  );

  if (!professional) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Professional not found' } });
    return;
  }

  // Get associated services
  const services = await db.query(
    `SELECT s.* FROM services s
     JOIN professional_services ps ON s.id = ps.service_id
     WHERE ps.professional_id = $1`,
    [req.params.id]
  );

  sendSuccess(res, { ...professional, services });
}));

// POST /api/professionals - Create professional (admin only)
router.post('/', requireTenantAdmin, validate(createProfessionalSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { email, password, firstName, lastName, phone, specialization, bio, serviceIds } = req.body;
  const tenantId = req.tenant!.id;

  // Check if email exists
  const existingUser = await db.queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existingUser) {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Email already exists' } });
    return;
  }

  const result = await db.transaction(async (client) => {
    // Create user
    const userId = uuid();
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'staff', $5, $6, $7, true, false, NOW(), NOW())`,
      [userId, tenantId, email.toLowerCase(), passwordHash, firstName, lastName, phone || null]
    );

    // Create professional
    const professionalId = uuid();
    const professional = await client.query(
      `INSERT INTO professionals (id, tenant_id, user_id, specialization, bio, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING *`,
      [professionalId, tenantId, userId, specialization || null, bio || null]
    );

    // Associate services
    if (serviceIds && serviceIds.length > 0) {
      for (const serviceId of serviceIds) {
        await client.query(
          'INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)',
          [professionalId, serviceId]
        );
      }
    }

    return { ...professional.rows[0], first_name: firstName, last_name: lastName, email };
  });

  sendCreated(res, result);
}));

// PATCH /api/professionals/:id - Update professional (admin only)
router.patch('/:id', requireTenantAdmin, validate(updateProfessionalSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { firstName, lastName, phone, specialization, bio, is_active, serviceIds } = req.body;
  const tenantId = req.tenant!.id;

  await db.transaction(async (client) => {
    // Get professional with user_id
    const professional = await client.query(
      'SELECT user_id FROM professionals WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );

    if (professional.rows.length === 0) {
      throw new Error('NOT_FOUND');
    }

    const userId = professional.rows[0].user_id;

    // Update user info
    if (firstName || lastName || phone) {
      const userUpdates: string[] = [];
      const userValues: any[] = [];
      let paramCount = 1;

      if (firstName) { userUpdates.push(`first_name = $${paramCount++}`); userValues.push(firstName); }
      if (lastName) { userUpdates.push(`last_name = $${paramCount++}`); userValues.push(lastName); }
      if (phone !== undefined) { userUpdates.push(`phone = $${paramCount++}`); userValues.push(phone); }

      if (userUpdates.length > 0) {
        userUpdates.push(`updated_at = NOW()`);
        userValues.push(userId);
        await client.query(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${paramCount}`,
          userValues
        );
      }
    }

    // Update professional info
    const profUpdates: string[] = [];
    const profValues: any[] = [];
    let pCount = 1;

    if (specialization !== undefined) { profUpdates.push(`specialization = $${pCount++}`); profValues.push(specialization); }
    if (bio !== undefined) { profUpdates.push(`bio = $${pCount++}`); profValues.push(bio); }
    if (is_active !== undefined) { profUpdates.push(`is_active = $${pCount++}`); profValues.push(is_active); }

    if (profUpdates.length > 0) {
      profUpdates.push(`updated_at = NOW()`);
      profValues.push(req.params.id);
      await client.query(
        `UPDATE professionals SET ${profUpdates.join(', ')} WHERE id = $${pCount}`,
        profValues
      );
    }

    // Update service associations
    if (serviceIds !== undefined) {
      await client.query('DELETE FROM professional_services WHERE professional_id = $1', [req.params.id]);
      for (const serviceId of serviceIds) {
        await client.query(
          'INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)',
          [req.params.id, serviceId]
        );
      }
    }
  });

  // Fetch updated professional
  const updated = await db.queryOne(
    `SELECT p.*, u.first_name, u.last_name, u.email, u.phone
     FROM professionals p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [req.params.id]
  );

  sendSuccess(res, updated);
}));

// DELETE /api/professionals/:id - Soft delete (admin only)
router.delete('/:id', requireTenantAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await db.query(
    'UPDATE professionals SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenant!.id]
  );

  res.status(204).send();
}));

export default router;
