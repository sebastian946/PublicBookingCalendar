import { Router } from 'express';
import { authMiddleware, requireTenantAdmin } from '../../middleware/auth.middleware.js';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { db } from '../../config/database.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';

const router = Router();

const dateRangeSchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  professional_id: z.string().uuid().optional(),
});

router.use(authMiddleware, requireTenant, requireTenantAdmin);

// GET /api/reports/dashboard - Dashboard KPIs
router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;

  const [bookingsStats, revenueStats, todayStats, professionalStats] = await Promise.all([
    // Total bookings by status
    db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM bookings
       WHERE tenant_id = $1
       GROUP BY status`,
      [tenantId]
    ),
    // Revenue
    db.queryOne<{ total_revenue: string; paid_bookings: string }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as paid_bookings
       FROM bookings
       WHERE tenant_id = $1 AND payment_status = 'completed'`,
      [tenantId]
    ),
    // Today's appointments
    db.queryOne<{ today_count: string; pending_today: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE date = CURRENT_DATE) as today_count,
         COUNT(*) FILTER (WHERE date = CURRENT_DATE AND status = 'pending') as pending_today
       FROM bookings
       WHERE tenant_id = $1`,
      [tenantId]
    ),
    // Active professionals
    db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM professionals WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    ),
  ]);

  const statusCounts = bookingsStats.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count);
    return acc;
  }, {} as Record<string, number>);

  sendSuccess(res, {
    bookings: {
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      byStatus: statusCounts,
      todayCount: parseInt(todayStats?.today_count || '0'),
      pendingToday: parseInt(todayStats?.pending_today || '0'),
    },
    revenue: {
      total: parseFloat(revenueStats?.total_revenue || '0'),
      paidBookings: parseInt(revenueStats?.paid_bookings || '0'),
    },
    professionals: {
      active: parseInt(professionalStats?.count || '0'),
    },
  });
}));

// GET /api/reports/bookings - Bookings report
router.get('/bookings', validate(dateRangeSchema, 'query'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const { from_date, to_date, professional_id } = req.query as Record<string, string>;

  const filters: string[] = ['b.tenant_id = $1'];
  const values: any[] = [tenantId];
  let paramCount = 2;

  if (from_date) {
    filters.push(`b.date >= $${paramCount++}`);
    values.push(from_date);
  }
  if (to_date) {
    filters.push(`b.date <= $${paramCount++}`);
    values.push(to_date);
  }
  if (professional_id) {
    filters.push(`b.professional_id = $${paramCount++}`);
    values.push(professional_id);
  }

  const whereClause = filters.join(' AND ');

  // Daily breakdown
  const dailyStats = await db.query(
    `SELECT
       b.date,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE b.status = 'completed') as completed,
       COUNT(*) FILTER (WHERE b.status = 'cancelled') as cancelled,
       COUNT(*) FILTER (WHERE b.status = 'no_show') as no_show,
       COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'completed'), 0) as revenue
     FROM bookings b
     WHERE ${whereClause}
     GROUP BY b.date
     ORDER BY b.date DESC`,
    values
  );

  // Service breakdown
  const serviceStats = await db.query(
    `SELECT
       s.name as service_name,
       COUNT(*) as bookings_count,
       COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'completed'), 0) as revenue
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     WHERE ${whereClause}
     GROUP BY s.id, s.name
     ORDER BY bookings_count DESC`,
    values
  );

  // Professional breakdown
  const professionalBreakdown = await db.query(
    `SELECT
       u.first_name || ' ' || u.last_name as professional_name,
       COUNT(*) as bookings_count,
       COALESCE(SUM(b.total_amount) FILTER (WHERE b.payment_status = 'completed'), 0) as revenue
     FROM bookings b
     JOIN professionals p ON b.professional_id = p.id
     JOIN users u ON p.user_id = u.id
     WHERE ${whereClause}
     GROUP BY p.id, u.first_name, u.last_name
     ORDER BY bookings_count DESC`,
    values
  );

  sendSuccess(res, {
    daily: dailyStats,
    byService: serviceStats,
    byProfessional: professionalBreakdown,
  });
}));

// GET /api/reports/revenue - Revenue report
router.get('/revenue', validate(dateRangeSchema, 'query'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const { from_date, to_date } = req.query as Record<string, string>;

  const filters: string[] = ['b.tenant_id = $1', "b.payment_status = 'completed'"];
  const values: any[] = [tenantId];
  let paramCount = 2;

  if (from_date) {
    filters.push(`b.date >= $${paramCount++}`);
    values.push(from_date);
  }
  if (to_date) {
    filters.push(`b.date <= $${paramCount++}`);
    values.push(to_date);
  }

  const whereClause = filters.join(' AND ');

  // Monthly revenue
  const monthlyRevenue = await db.query(
    `SELECT
       TO_CHAR(b.date, 'YYYY-MM') as month,
       SUM(b.total_amount) as revenue,
       COUNT(*) as bookings_count
     FROM bookings b
     WHERE ${whereClause}
     GROUP BY TO_CHAR(b.date, 'YYYY-MM')
     ORDER BY month DESC`,
    values
  );

  // Payment provider breakdown
  const providerBreakdown = await db.query(
    `SELECT
       p.provider,
       SUM(p.amount) as total,
       COUNT(*) as count
     FROM payments p
     JOIN bookings b ON p.booking_id = b.id
     WHERE b.tenant_id = $1 AND p.status = 'completed'
     GROUP BY p.provider`,
    [tenantId]
  );

  sendSuccess(res, {
    monthly: monthlyRevenue,
    byProvider: providerBreakdown,
  });
}));

// GET /api/reports/export - Export report data as CSV
router.get('/export', validate(dateRangeSchema, 'query'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tenantId = req.tenant!.id;
  const { from_date, to_date } = req.query as Record<string, string>;

  const filters: string[] = ['b.tenant_id = $1'];
  const values: any[] = [tenantId];
  let paramCount = 2;

  if (from_date) {
    filters.push(`b.date >= $${paramCount++}`);
    values.push(from_date);
  }
  if (to_date) {
    filters.push(`b.date <= $${paramCount++}`);
    values.push(to_date);
  }

  const bookings = await db.query(
    `SELECT
       b.id,
       b.date,
       b.start_time,
       b.end_time,
       b.status,
       b.visit_type,
       b.total_amount,
       b.currency,
       b.payment_status,
       s.name as service_name,
       pu.first_name || ' ' || pu.last_name as professional_name,
       cu.first_name || ' ' || cu.last_name as client_name,
       cu.email as client_email
     FROM bookings b
     LEFT JOIN services s ON b.service_id = s.id
     LEFT JOIN professionals p ON b.professional_id = p.id
     LEFT JOIN users pu ON p.user_id = pu.id
     LEFT JOIN users cu ON b.client_id = cu.id
     WHERE ${filters.join(' AND ')}
     ORDER BY b.date DESC, b.start_time`,
    values
  );

  // Generate CSV
  const headers = [
    'ID', 'Date', 'Start Time', 'End Time', 'Status', 'Visit Type',
    'Amount', 'Currency', 'Payment Status', 'Service', 'Professional', 'Client', 'Client Email'
  ];

  const csv = [
    headers.join(','),
    ...bookings.map((b: any) =>
      [
        b.id, b.date, b.start_time, b.end_time, b.status, b.visit_type,
        b.total_amount, b.currency, b.payment_status,
        `"${b.service_name || ''}"`, `"${b.professional_name || ''}"`,
        `"${b.client_name || ''}"`, b.client_email || ''
      ].join(',')
    )
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=bookings-export-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csv);
}));

export default router;
