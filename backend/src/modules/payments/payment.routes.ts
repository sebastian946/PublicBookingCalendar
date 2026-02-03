import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireTenant } from '../../middleware/tenant.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import Stripe from 'stripe';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { io } from '../../app.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { asyncHandler } from '../../middleware/error.middleware.js';
import { logger } from '../../utils/logger.js';
import type { AuthenticatedRequest, Booking, Payment } from '../../types/index.js';

const router = Router();

// Initialize payment providers
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const mercadopago = env.MERCADOPAGO_ACCESS_TOKEN
  ? new MercadoPagoConfig({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN })
  : null;

const createPaymentIntentSchema = z.object({
  booking_id: z.string().uuid(),
});

const createPreferenceSchema = z.object({
  booking_id: z.string().uuid(),
  success_url: z.string().url(),
  failure_url: z.string().url(),
  pending_url: z.string().url().optional(),
});

// POST /api/payments/create-intent - Create Stripe PaymentIntent
router.post('/create-intent', authMiddleware, requireTenant, validate(createPaymentIntentSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!stripe) {
    res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Stripe not configured' } });
    return;
  }

  const { booking_id } = req.body;
  const tenantId = req.tenant!.id;

  // Get booking
  const booking = await db.queryOne<Booking>(
    'SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2',
    [booking_id, tenantId]
  );

  if (!booking) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  if (booking.payment_status === 'completed') {
    res.status(400).json({ success: false, error: { code: 'ALREADY_PAID', message: 'Booking already paid' } });
    return;
  }

  // Create PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(booking.total_amount * 100), // Stripe uses cents
    currency: booking.currency.toLowerCase(),
    metadata: {
      booking_id: booking.id,
      tenant_id: tenantId,
    },
  });

  // Store payment record
  await db.query(
    `INSERT INTO payments (id, tenant_id, booking_id, provider, provider_payment_id, amount, currency, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, 'stripe', $4, $5, $6, 'pending', $7, NOW(), NOW())`,
    [uuid(), tenantId, booking_id, paymentIntent.id, booking.total_amount, booking.currency, JSON.stringify({ client_secret: paymentIntent.client_secret })]
  );

  sendSuccess(res, {
    clientSecret: paymentIntent.client_secret,
    amount: booking.total_amount,
    currency: booking.currency,
  });
}));

// POST /api/payments/create-preference - Create MercadoPago preference
router.post('/create-preference', authMiddleware, requireTenant, validate(createPreferenceSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!mercadopago) {
    res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'MercadoPago not configured' } });
    return;
  }

  const { booking_id, success_url, failure_url, pending_url } = req.body;
  const tenantId = req.tenant!.id;

  // Get booking with service info
  const booking = await db.queryOne<Booking & { service_name: string }>(
    `SELECT b.*, s.name as service_name FROM bookings b
     JOIN services s ON b.service_id = s.id
     WHERE b.id = $1 AND b.tenant_id = $2`,
    [booking_id, tenantId]
  );

  if (!booking) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  const preference = new Preference(mercadopago);
  const result = await preference.create({
    body: {
      items: [
        {
          id: booking.id,
          title: booking.service_name,
          quantity: 1,
          unit_price: booking.total_amount,
          currency_id: booking.currency,
        },
      ],
      back_urls: {
        success: success_url,
        failure: failure_url,
        pending: pending_url || success_url,
      },
      auto_return: 'approved',
      external_reference: booking.id,
      metadata: {
        booking_id: booking.id,
        tenant_id: tenantId,
      },
    },
  });

  // Store payment record
  await db.query(
    `INSERT INTO payments (id, tenant_id, booking_id, provider, provider_payment_id, amount, currency, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, 'mercadopago', $4, $5, $6, 'pending', $7, NOW(), NOW())`,
    [uuid(), tenantId, booking_id, result.id, booking.total_amount, booking.currency, JSON.stringify({ preference_id: result.id })]
  );

  sendSuccess(res, {
    preferenceId: result.id,
    initPoint: result.init_point,
    sandboxInitPoint: result.sandbox_init_point,
  });
}));

// POST /api/webhooks/stripe - Stripe webhook
router.post('/webhooks/stripe', asyncHandler(async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata.booking_id;
    const tenantId = paymentIntent.metadata.tenant_id;

    // Update payment and booking
    await db.transaction(async (client) => {
      await client.query(
        `UPDATE payments SET status = 'completed', updated_at = NOW()
         WHERE provider_payment_id = $1`,
        [paymentIntent.id]
      );

      await client.query(
        `UPDATE bookings SET payment_status = 'completed', payment_id = $1, status = 'confirmed', updated_at = NOW()
         WHERE id = $2`,
        [paymentIntent.id, bookingId]
      );
    });

    io.to(`tenant:${tenantId}`).emit('payment:completed', { booking_id: bookingId });
    logger.info({ bookingId }, 'Stripe payment completed');
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    await db.query(
      `UPDATE payments SET status = 'failed', updated_at = NOW()
       WHERE provider_payment_id = $1`,
      [paymentIntent.id]
    );

    logger.warn({ paymentIntentId: paymentIntent.id }, 'Stripe payment failed');
  }

  res.json({ received: true });
}));

// POST /api/webhooks/mercadopago - MercadoPago webhook
router.post('/webhooks/mercadopago', asyncHandler(async (req, res) => {
  if (!mercadopago) {
    res.status(503).json({ error: 'MercadoPago not configured' });
    return;
  }

  const { type, data } = req.body;

  if (type === 'payment') {
    const payment = new MPPayment(mercadopago);
    const paymentData = await payment.get({ id: data.id });

    if (paymentData.status === 'approved') {
      const bookingId = paymentData.external_reference;
      const tenantId = paymentData.metadata?.tenant_id;

      await db.transaction(async (client) => {
        await client.query(
          `UPDATE payments SET status = 'completed', provider_payment_id = $1, updated_at = NOW()
           WHERE booking_id = $2 AND provider = 'mercadopago'`,
          [data.id, bookingId]
        );

        await client.query(
          `UPDATE bookings SET payment_status = 'completed', payment_id = $1, status = 'confirmed', updated_at = NOW()
           WHERE id = $2`,
          [data.id, bookingId]
        );
      });

      if (tenantId) {
        io.to(`tenant:${tenantId}`).emit('payment:completed', { booking_id: bookingId });
      }

      logger.info({ bookingId }, 'MercadoPago payment completed');
    }
  }

  res.json({ received: true });
}));

// GET /api/payments/booking/:bookingId - Get payment info for booking
router.get('/booking/:bookingId', authMiddleware, requireTenant, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payment = await db.queryOne<Payment>(
    `SELECT * FROM payments WHERE booking_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [req.params.bookingId, req.tenant!.id]
  );

  if (!payment) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
    return;
  }

  sendSuccess(res, payment);
}));

export default router;
