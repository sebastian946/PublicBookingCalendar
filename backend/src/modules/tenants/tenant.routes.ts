import { Router } from 'express';
import { authMiddleware, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { db } from '../../config/database.js';
import { sendSuccess, sendPaginated, getPaginationParams, getOffset } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest, Tenant } from '../../types/index.js';

const router = Router();

// All tenant routes require super admin
router.use(authMiddleware, requireSuperAdmin);

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  settings: z.object({
    timezone: z.string().optional(),
    currency: z.string().optional(),
    locale: z.string().optional(),
    booking_advance_days: z.number().min(1).max(365).optional(),
    cancellation_hours: z.number().min(0).max(168).optional(),
    reminder_hours: z.array(z.number()).optional(),
    payment_required: z.boolean().optional(),
    allow_virtual_visits: z.boolean().optional(),
  }).optional(),
  is_active: z.boolean().optional(),
});

// GET /api/tenants - List all tenants
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const params = getPaginationParams(req.query);
  const offset = getOffset(params);

  const [tenants, countResult] = await Promise.all([
    db.query<Tenant>(
      `SELECT id, name, slug, subdomain, subscription_plan, is_active, created_at
       FROM tenants
       ORDER BY ${params.sortBy} ${params.sortOrder}
       LIMIT $1 OFFSET $2`,
      [params.limit, offset]
    ),
    db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM tenants'),
  ]);

  sendPaginated(res, tenants, parseInt(countResult?.count || '0'), params);
}));

// GET /api/tenants/:id - Get tenant by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenant = await db.queryOne<Tenant>(
    'SELECT * FROM tenants WHERE id = $1',
    [req.params.id]
  );

  if (!tenant) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return;
  }

  sendSuccess(res, tenant);
}));

// PATCH /api/tenants/:id - Update tenant
router.patch('/:id', validate(updateTenantSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, settings, is_active } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (settings !== undefined) {
    updates.push(`settings = settings || $${paramCount++}::jsonb`);
    values.push(JSON.stringify(settings));
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(is_active);
  }

  if (updates.length === 0) {
    sendSuccess(res, { message: 'No changes' });
    return;
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const tenant = await db.queryOne<Tenant>(
    `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (!tenant) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return;
  }

  sendSuccess(res, tenant);
}));

// DELETE /api/tenants/:id - Soft delete tenant
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const result = await db.query(
    'UPDATE tenants SET is_active = false, updated_at = NOW() WHERE id = $1',
    [req.params.id]
  );

  res.status(204).send();
}));

export default router;
