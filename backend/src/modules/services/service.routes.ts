import { Router } from 'express';
import { authMiddleware, requireTenantAdmin } from '../../middleware/auth.middleware.js';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { db } from '../../config/database.js';
import { sendSuccess, sendCreated, sendPaginated, getPaginationParams, getOffset } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest, Service } from '../../types/index.js';

const router = Router();

const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  duration_minutes: z.number().min(5).max(480),
  price: z.number().min(0),
  currency: z.string().length(3).default('USD'),
});

const updateServiceSchema = createServiceSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// All routes require authentication and tenant
router.use(authMiddleware, requireTenant);

// GET /api/services - List services
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const params = getPaginationParams(req.query);
  const offset = getOffset(params);
  const tenantId = req.tenant!.id;

  const showInactive = req.query.showInactive === 'true' && ['super_admin', 'tenant_admin'].includes(req.user!.role);

  const whereClause = showInactive
    ? 'tenant_id = $1'
    : 'tenant_id = $1 AND is_active = true';

  const [services, countResult] = await Promise.all([
    db.query<Service>(
      `SELECT * FROM services WHERE ${whereClause}
       ORDER BY ${params.sortBy} ${params.sortOrder}
       LIMIT $2 OFFSET $3`,
      [tenantId, params.limit, offset]
    ),
    db.queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM services WHERE ${whereClause}`, [tenantId]),
  ]);

  sendPaginated(res, services, parseInt(countResult?.count || '0'), params);
}));

// GET /api/services/:id - Get service by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const service = await db.queryOne<Service>(
    'SELECT * FROM services WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenant!.id]
  );

  if (!service) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return;
  }

  sendSuccess(res, service);
}));

// POST /api/services - Create service (admin only)
router.post('/', requireTenantAdmin, validate(createServiceSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, description, duration_minutes, price, currency } = req.body;
  const tenantId = req.tenant!.id;

  const service = await db.queryOne<Service>(
    `INSERT INTO services (id, tenant_id, name, description, duration_minutes, price, currency, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
     RETURNING *`,
    [uuid(), tenantId, name, description || null, duration_minutes, price, currency]
  );

  sendCreated(res, service);
}));

// PATCH /api/services/:id - Update service (admin only)
router.patch('/:id', requireTenantAdmin, validate(updateServiceSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, description, duration_minutes, price, currency, is_active } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
  if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
  if (duration_minutes !== undefined) { updates.push(`duration_minutes = $${paramCount++}`); values.push(duration_minutes); }
  if (price !== undefined) { updates.push(`price = $${paramCount++}`); values.push(price); }
  if (currency !== undefined) { updates.push(`currency = $${paramCount++}`); values.push(currency); }
  if (is_active !== undefined) { updates.push(`is_active = $${paramCount++}`); values.push(is_active); }

  if (updates.length === 0) {
    sendSuccess(res, { message: 'No changes' });
    return;
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id, req.tenant!.id);

  const service = await db.queryOne<Service>(
    `UPDATE services SET ${updates.join(', ')} WHERE id = $${paramCount++} AND tenant_id = $${paramCount} RETURNING *`,
    values
  );

  if (!service) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return;
  }

  sendSuccess(res, service);
}));

// DELETE /api/services/:id - Soft delete service (admin only)
router.delete('/:id', requireTenantAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await db.query(
    'UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenant!.id]
  );

  res.status(204).send();
}));

export default router;
