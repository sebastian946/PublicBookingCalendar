import { Router } from 'express';
import { authMiddleware, requireStaff } from '../../middleware/auth.middleware.js';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { addDays, format, parse, addMinutes, isBefore, isAfter } from 'date-fns';
import { db } from '../../config/database.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest, AvailabilityRule, TimeSlot } from '../../types/index.js';

const router = Router();

const createRuleSchema = z.object({
  professional_id: z.string().uuid(),
  day_of_week: z.number().min(0).max(6), // 0 = Sunday, 6 = Saturday
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:mm
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

const updateRuleSchema = createRuleSchema.partial().omit({ professional_id: true }).extend({
  is_active: z.boolean().optional(),
});

const createExceptionSchema = z.object({
  professional_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  is_available: z.boolean(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  reason: z.string().max(200).optional(),
});

const getSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_id: z.string().uuid().optional(),
});

router.use(authMiddleware, requireTenant);

// GET /api/availability/rules/:professionalId - Get availability rules
router.get('/rules/:professionalId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const rules = await db.query<AvailabilityRule>(
    `SELECT * FROM availability_rules
     WHERE professional_id = $1 AND tenant_id = $2 AND is_active = true
     ORDER BY day_of_week, start_time`,
    [req.params.professionalId, req.tenant!.id]
  );

  sendSuccess(res, rules);
}));

// POST /api/availability/rules - Create rule
router.post('/rules', requireStaff, validate(createRuleSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { professional_id, day_of_week, start_time, end_time } = req.body;

  const rule = await db.queryOne<AvailabilityRule>(
    `INSERT INTO availability_rules (id, tenant_id, professional_id, day_of_week, start_time, end_time, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
     RETURNING *`,
    [uuid(), req.tenant!.id, professional_id, day_of_week, start_time, end_time]
  );

  sendCreated(res, rule);
}));

// PATCH /api/availability/rules/:id - Update rule
router.patch('/rules/:id', requireStaff, validate(updateRuleSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { day_of_week, start_time, end_time, is_active } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (day_of_week !== undefined) { updates.push(`day_of_week = $${paramCount++}`); values.push(day_of_week); }
  if (start_time !== undefined) { updates.push(`start_time = $${paramCount++}`); values.push(start_time); }
  if (end_time !== undefined) { updates.push(`end_time = $${paramCount++}`); values.push(end_time); }
  if (is_active !== undefined) { updates.push(`is_active = $${paramCount++}`); values.push(is_active); }

  if (updates.length === 0) {
    sendSuccess(res, { message: 'No changes' });
    return;
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id, req.tenant!.id);

  const rule = await db.queryOne<AvailabilityRule>(
    `UPDATE availability_rules SET ${updates.join(', ')} WHERE id = $${paramCount++} AND tenant_id = $${paramCount} RETURNING *`,
    values
  );

  sendSuccess(res, rule);
}));

// DELETE /api/availability/rules/:id - Delete rule
router.delete('/rules/:id', requireStaff, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await db.query(
    'DELETE FROM availability_rules WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.tenant!.id]
  );

  res.status(204).send();
}));

// POST /api/availability/exceptions - Create exception
router.post('/exceptions', requireStaff, validate(createExceptionSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { professional_id, date, is_available, start_time, end_time, reason } = req.body;

  const exception = await db.queryOne(
    `INSERT INTO availability_exceptions (id, professional_id, date, is_available, start_time, end_time, reason, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [uuid(), professional_id, date, is_available, start_time || null, end_time || null, reason || null]
  );

  sendCreated(res, exception);
}));

// GET /api/availability/slots/:professionalId - Get available slots for a date
router.get('/slots/:professionalId', validate(getSlotsQuerySchema, 'query'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { date, service_id } = req.query as { date: string; service_id?: string };
  const professionalId = req.params.professionalId;
  const tenantId = req.tenant!.id;

  // Get service duration (default 30 min)
  let durationMinutes = 30;
  if (service_id) {
    const service = await db.queryOne<{ duration_minutes: number }>(
      'SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2',
      [service_id, tenantId]
    );
    if (service) {
      durationMinutes = service.duration_minutes;
    }
  }

  const dateObj = parse(date, 'yyyy-MM-dd', new Date());
  const dayOfWeek = dateObj.getDay();

  // Check for exceptions on this date
  const exception = await db.queryOne(
    `SELECT * FROM availability_exceptions
     WHERE professional_id = $1 AND date = $2`,
    [professionalId, date]
  );

  // If there's an exception marking as unavailable, return empty
  if (exception && !exception.is_available) {
    sendSuccess(res, []);
    return;
  }

  // Get availability rules for this day
  const rules = await db.query<AvailabilityRule>(
    `SELECT * FROM availability_rules
     WHERE professional_id = $1 AND tenant_id = $2 AND day_of_week = $3 AND is_active = true
     ORDER BY start_time`,
    [professionalId, tenantId, dayOfWeek]
  );

  if (rules.length === 0) {
    sendSuccess(res, []);
    return;
  }

  // Get existing bookings for this date
  const existingBookings = await db.query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM bookings
     WHERE professional_id = $1 AND date = $2 AND status NOT IN ('cancelled')`,
    [professionalId, date]
  );

  // Generate available slots
  const slots: Array<{ start_time: string; end_time: string; available: boolean }> = [];

  for (const rule of rules) {
    let currentTime = parse(rule.start_time, 'HH:mm', dateObj);
    const endTime = parse(rule.end_time, 'HH:mm', dateObj);

    while (isBefore(addMinutes(currentTime, durationMinutes), endTime) || format(addMinutes(currentTime, durationMinutes), 'HH:mm') === rule.end_time) {
      const slotStart = format(currentTime, 'HH:mm');
      const slotEnd = format(addMinutes(currentTime, durationMinutes), 'HH:mm');

      // Check if slot conflicts with existing booking
      const isBooked = existingBookings.some((booking) => {
        return (slotStart < booking.end_time && slotEnd > booking.start_time);
      });

      slots.push({
        start_time: slotStart,
        end_time: slotEnd,
        available: !isBooked,
      });

      currentTime = addMinutes(currentTime, durationMinutes);

      if (isAfter(currentTime, endTime) || format(currentTime, 'HH:mm') === rule.end_time) {
        break;
      }
    }
  }

  sendSuccess(res, slots);
}));

export default router;
