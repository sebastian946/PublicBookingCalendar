import { Router } from 'express';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { parse, format, addMinutes, isBefore, isAfter } from 'date-fns';
import { db } from '../../config/database.js';
import { io } from '../../app.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import { notificationService } from '../notifications/notification.service.js';
import type { AuthenticatedRequest, Service, Professional, AvailabilityRule } from '../../types/index.js';

const router = Router();

// All public routes require tenant context
router.use(requireTenant);

const createPublicBookingSchema = z.object({
  professional_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  visit_type: z.enum(['in_person', 'virtual']),
  notes: z.string().max(1000).optional(),
  // Client info
  client_email: z.string().email(),
  client_name: z.string().min(1).max(100),
  client_phone: z.string().optional(),
});

// GET /api/public/services - List public services
router.get('/services', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;

  const services = await db.query<Service>(
    `SELECT id, name, description, duration_minutes, price, currency
     FROM services
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY name`,
    [tenantId]
  );

  sendSuccess(res, services);
}));

// GET /api/public/professionals - List public professionals
router.get('/professionals', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const serviceId = req.query.service_id as string;

  let query = `
    SELECT p.id, p.specialization, p.bio, p.avatar_url,
           u.first_name, u.last_name
    FROM professionals p
    JOIN users u ON p.user_id = u.id
    WHERE p.tenant_id = $1 AND p.is_active = true
  `;
  const values: any[] = [tenantId];

  if (serviceId) {
    query += ` AND EXISTS (
      SELECT 1 FROM professional_services ps WHERE ps.professional_id = p.id AND ps.service_id = $2
    )`;
    values.push(serviceId);
  }

  query += ' ORDER BY u.first_name, u.last_name';

  const professionals = await db.query(query, values);

  sendSuccess(res, professionals);
}));

// GET /api/public/slots - Get available slots
router.get('/slots', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const { professional_id, service_id, date } = req.query as Record<string, string>;

  if (!professional_id || !service_id || !date) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'professional_id, service_id, and date are required' }
    });
    return;
  }

  // Get service duration
  const service = await db.queryOne<{ duration_minutes: number }>(
    'SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2 AND is_active = true',
    [service_id, tenantId]
  );

  if (!service) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return;
  }

  const durationMinutes = service.duration_minutes;
  const dateObj = parse(date, 'yyyy-MM-dd', new Date());
  const dayOfWeek = dateObj.getDay();

  // Check for exceptions
  const exception = await db.queryOne(
    'SELECT * FROM availability_exceptions WHERE professional_id = $1 AND date = $2',
    [professional_id, date]
  );

  if (exception && !exception.is_available) {
    sendSuccess(res, []);
    return;
  }

  // Get availability rules
  const rules = await db.query<AvailabilityRule>(
    `SELECT * FROM availability_rules
     WHERE professional_id = $1 AND tenant_id = $2 AND day_of_week = $3 AND is_active = true
     ORDER BY start_time`,
    [professional_id, tenantId, dayOfWeek]
  );

  if (rules.length === 0) {
    sendSuccess(res, []);
    return;
  }

  // Get existing bookings
  const existingBookings = await db.query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM bookings
     WHERE professional_id = $1 AND date = $2 AND status NOT IN ('cancelled')`,
    [professional_id, date]
  );

  // Generate slots
  const slots: Array<{ start_time: string; end_time: string; available: boolean }> = [];

  for (const rule of rules) {
    let currentTime = parse(rule.start_time, 'HH:mm', dateObj);
    const endTime = parse(rule.end_time, 'HH:mm', dateObj);

    while (isBefore(addMinutes(currentTime, durationMinutes), endTime) ||
           format(addMinutes(currentTime, durationMinutes), 'HH:mm') === rule.end_time) {
      const slotStart = format(currentTime, 'HH:mm');
      const slotEnd = format(addMinutes(currentTime, durationMinutes), 'HH:mm');

      const isBooked = existingBookings.some((booking) =>
        slotStart < booking.end_time && slotEnd > booking.start_time
      );

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

  // Filter only available slots
  const availableSlots = slots.filter(s => s.available);

  sendSuccess(res, availableSlots);
}));

// POST /api/public/bookings - Create public booking
router.post('/bookings', validate(createPublicBookingSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const {
    professional_id, service_id, date, start_time, end_time, visit_type, notes,
    client_email, client_name, client_phone
  } = req.body;
  const tenantId = req.tenant!.id;

  // Get service
  const service = await db.queryOne<Service>(
    'SELECT * FROM services WHERE id = $1 AND tenant_id = $2 AND is_active = true',
    [service_id, tenantId]
  );

  if (!service) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return;
  }

  // Check for conflicts
  const conflict = await db.queryOne(
    `SELECT id FROM bookings
     WHERE professional_id = $1 AND date = $2 AND status NOT IN ('cancelled')
     AND (start_time < $4 AND end_time > $3)`,
    [professional_id, date, start_time, end_time]
  );

  if (conflict) {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Time slot is not available' } });
    return;
  }

  // Find or create client
  let clientId: string;
  const existingClient = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
    [client_email.toLowerCase(), tenantId]
  );

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    clientId = uuid();
    const nameParts = client_name.split(' ');
    await db.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, '', 'client', $4, $5, $6, true, false, NOW(), NOW())`,
      [clientId, tenantId, client_email.toLowerCase(), nameParts[0], nameParts.slice(1).join(' ') || '', client_phone || null]
    );
  }

  // Create booking
  const bookingId = uuid();
  const booking = await db.queryOne(
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

  // Schedule notifications
  try {
    await notificationService.scheduleBookingNotifications(bookingId, tenantId);
  } catch (err) {
    // Don't fail the booking if notifications fail
    console.error('Failed to schedule notifications:', err);
  }

  // Return booking with service info
  sendCreated(res, {
    ...booking,
    service_name: service.name,
    service_duration: service.duration_minutes,
  });
}));

// GET /api/public/tenant - Get public tenant info
router.get('/tenant', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenant = req.tenant!;

  sendSuccess(res, {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    settings: {
      timezone: tenant.settings.timezone,
      currency: tenant.settings.currency,
      allow_virtual_visits: tenant.settings.allow_virtual_visits,
      booking_advance_days: tenant.settings.booking_advance_days,
    },
  });
}));

export default router;
