import { Router } from 'express';
import { authMiddleware, requireStaff, optionalAuth } from '../../middleware/auth.middleware.js';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { db } from '../../config/database.js';
import { io } from '../../app.js';
import { sendSuccess, sendCreated, sendPaginated, getPaginationParams, getOffset } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest, Booking } from '../../types/index.js';

const router = Router();

const createBookingSchema = z.object({
  professional_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  visit_type: z.enum(['in_person', 'virtual']),
  notes: z.string().max(1000).optional(),
  // Client info (for guest bookings)
  client_email: z.string().email().optional(),
  client_name: z.string().min(1).optional(),
  client_phone: z.string().optional(),
});

const updateBookingSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(1000).optional(),
  cancellation_reason: z.string().max(500).optional(),
});

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

router.use(requireTenant);

// GET /api/bookings - List bookings (staff only)
router.get('/', authMiddleware, requireStaff, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const params = getPaginationParams(req.query);
  const offset = getOffset(params);
  const tenantId = req.tenant!.id;

  const filters: string[] = ['b.tenant_id = $1'];
  const values: any[] = [tenantId];
  let paramCount = 2;

  // Apply filters
  if (req.query.status) {
    filters.push(`b.status = $${paramCount++}`);
    values.push(req.query.status);
  }
  if (req.query.professional_id) {
    filters.push(`b.professional_id = $${paramCount++}`);
    values.push(req.query.professional_id);
  }
  if (req.query.date) {
    filters.push(`b.date = $${paramCount++}`);
    values.push(req.query.date);
  }
  if (req.query.from_date) {
    filters.push(`b.date >= $${paramCount++}`);
    values.push(req.query.from_date);
  }
  if (req.query.to_date) {
    filters.push(`b.date <= $${paramCount++}`);
    values.push(req.query.to_date);
  }

  const whereClause = filters.join(' AND ');

  const bookings = await db.query(
    `SELECT b.*,
            s.name as service_name, s.duration_minutes, s.price,
            p.specialization,
            pu.first_name as professional_first_name, pu.last_name as professional_last_name,
            cu.first_name as client_first_name, cu.last_name as client_last_name, cu.email as client_email
     FROM bookings b
     LEFT JOIN services s ON b.service_id = s.id
     LEFT JOIN professionals p ON b.professional_id = p.id
     LEFT JOIN users pu ON p.user_id = pu.id
     LEFT JOIN users cu ON b.client_id = cu.id
     WHERE ${whereClause}
     ORDER BY b.date DESC, b.start_time DESC
     LIMIT $${paramCount++} OFFSET $${paramCount}`,
    [...values, params.limit, offset]
  );

  const countResult = await db.queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM bookings b WHERE ${whereClause}`,
    values
  );

  sendPaginated(res, bookings, parseInt(countResult?.count || '0'), params);
}));

// GET /api/bookings/:id - Get booking
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const booking = await db.queryOne(
    `SELECT b.*,
            s.name as service_name, s.duration_minutes, s.price,
            pu.first_name as professional_first_name, pu.last_name as professional_last_name,
            cu.first_name as client_first_name, cu.last_name as client_last_name, cu.email as client_email
     FROM bookings b
     LEFT JOIN services s ON b.service_id = s.id
     LEFT JOIN professionals p ON b.professional_id = p.id
     LEFT JOIN users pu ON p.user_id = pu.id
     LEFT JOIN users cu ON b.client_id = cu.id
     WHERE b.id = $1 AND b.tenant_id = $2`,
    [req.params.id, req.tenant!.id]
  );

  if (!booking) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  // Check access: staff can see all, clients can only see their own
  if (req.user!.role === 'client' && booking.client_id !== req.user!.id) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    return;
  }

  sendSuccess(res, booking);
}));

// POST /api/bookings - Create booking
router.post('/', optionalAuth, validate(createBookingSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const {
    professional_id, service_id, date, start_time, end_time, visit_type, notes,
    client_email, client_name, client_phone
  } = req.body;
  const tenantId = req.tenant!.id;

  // Get service to determine price
  const service = await db.queryOne<{ price: number; currency: string }>(
    'SELECT price, currency FROM services WHERE id = $1 AND tenant_id = $2',
    [service_id, tenantId]
  );

  if (!service) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return;
  }

  // Check for conflicting bookings
  const conflict = await db.queryOne(
    `SELECT id FROM bookings
     WHERE professional_id = $1 AND date = $2 AND status NOT IN ('cancelled')
     AND ((start_time < $4 AND end_time > $3))`,
    [professional_id, date, start_time, end_time]
  );

  if (conflict) {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Time slot is not available' } });
    return;
  }

  // Determine client_id
  let clientId = req.user?.id || null;

  // If no authenticated user, create a guest client
  if (!clientId && client_email) {
    const existingClient = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [client_email.toLowerCase(), tenantId]
    );

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // Create guest user
      clientId = uuid();
      const nameParts = (client_name || 'Guest').split(' ');
      await db.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, '', 'client', $4, $5, $6, true, false, NOW(), NOW())`,
        [clientId, tenantId, client_email.toLowerCase(), nameParts[0], nameParts.slice(1).join(' ') || '', client_phone || null]
      );
    }
  }

  // Create booking
  const bookingId = uuid();
  const booking = await db.queryOne<Booking>(
    `INSERT INTO bookings (id, tenant_id, client_id, professional_id, service_id, date, start_time, end_time, status, visit_type, notes, payment_status, total_amount, currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, 'pending', $11, $12, NOW(), NOW())
     RETURNING *`,
    [bookingId, tenantId, clientId, professional_id, service_id, date, start_time, end_time, visit_type, notes || null, service.price, service.currency]
  );

  // Emit WebSocket event
  io.to(`tenant:${tenantId}`).emit('booking:created', {
    id: booking!.id,
    professional_id,
    date,
    start_time,
    end_time,
  });

  sendCreated(res, booking);
}));

// PATCH /api/bookings/:id - Update booking
router.patch('/:id', authMiddleware, requireStaff, validate(updateBookingSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, notes, cancellation_reason } = req.body;
  const tenantId = req.tenant!.id;

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);

    if (status === 'cancelled') {
      updates.push(`cancelled_at = NOW()`);
      updates.push(`cancelled_by = $${paramCount++}`);
      values.push(req.user!.id);
    }
  }
  if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
  if (cancellation_reason !== undefined) { updates.push(`cancellation_reason = $${paramCount++}`); values.push(cancellation_reason); }

  if (updates.length === 0) {
    sendSuccess(res, { message: 'No changes' });
    return;
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id, tenantId);

  const booking = await db.queryOne<Booking>(
    `UPDATE bookings SET ${updates.join(', ')} WHERE id = $${paramCount++} AND tenant_id = $${paramCount} RETURNING *`,
    values
  );

  if (!booking) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  // Emit WebSocket event
  io.to(`tenant:${tenantId}`).emit('booking:updated', {
    id: booking.id,
    status: booking.status,
    professional_id: booking.professional_id,
    date: booking.date,
  });

  sendSuccess(res, booking);
}));

// POST /api/bookings/:id/confirm - Confirm booking
router.post('/:id/confirm', authMiddleware, requireStaff, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;

  const booking = await db.queryOne<Booking>(
    `UPDATE bookings SET status = 'confirmed', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING *`,
    [req.params.id, tenantId]
  );

  if (!booking) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found or already confirmed' } });
    return;
  }

  io.to(`tenant:${tenantId}`).emit('booking:confirmed', { id: booking.id });

  sendSuccess(res, booking);
}));

// POST /api/bookings/:id/cancel - Cancel booking
router.post('/:id/cancel', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const { reason } = req.body;

  const booking = await db.queryOne<Booking>(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $3, cancellation_reason = $4, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('cancelled', 'completed')
     RETURNING *`,
    [req.params.id, tenantId, req.user!.id, reason || null]
  );

  if (!booking) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found or cannot be cancelled' } });
    return;
  }

  io.to(`tenant:${tenantId}`).emit('booking:cancelled', {
    id: booking.id,
    professional_id: booking.professional_id,
    date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
  });

  sendSuccess(res, booking);
}));

// POST /api/bookings/:id/reschedule - Reschedule booking
router.post('/:id/reschedule', authMiddleware, validate(rescheduleSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const { date, start_time, end_time } = req.body;

  // Get original booking
  const original = await db.queryOne<Booking>(
    'SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2',
    [req.params.id, tenantId]
  );

  if (!original) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  // Check for conflicts at new time
  const conflict = await db.queryOne(
    `SELECT id FROM bookings
     WHERE professional_id = $1 AND date = $2 AND status NOT IN ('cancelled') AND id != $5
     AND ((start_time < $4 AND end_time > $3))`,
    [original.professional_id, date, start_time, end_time, req.params.id]
  );

  if (conflict) {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'New time slot is not available' } });
    return;
  }

  const booking = await db.queryOne<Booking>(
    `UPDATE bookings SET date = $3, start_time = $4, end_time = $5, status = 'pending', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [req.params.id, tenantId, date, start_time, end_time]
  );

  io.to(`tenant:${tenantId}`).emit('booking:rescheduled', {
    id: booking!.id,
    old_date: original.date,
    old_start_time: original.start_time,
    new_date: date,
    new_start_time: start_time,
  });

  sendSuccess(res, booking);
}));

export default router;
