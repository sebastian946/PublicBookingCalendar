import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { Queue, Worker } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { addHours, format } from 'date-fns';
import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { Booking, Notification, NotificationType, NotificationChannel } from '../../types/index.js';

// Initialize SendGrid
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

// Initialize Twilio
const twilioClient = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
  ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  : null;

// Create notification queue
export const notificationQueue = new Queue('notifications', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

interface NotificationJobData {
  notificationId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
  bookingId: string;
  tenantId: string;
}

// Email templates
const emailTemplates = {
  confirmation: (booking: any) => ({
    subject: `Booking Confirmation - ${format(new Date(booking.date), 'MMMM d, yyyy')}`,
    html: `
      <h2>Your Booking is Confirmed!</h2>
      <p>Hello ${booking.client_name},</p>
      <p>Your appointment has been confirmed for:</p>
      <ul>
        <li><strong>Date:</strong> ${format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</li>
        <li><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</li>
        <li><strong>Service:</strong> ${booking.service_name}</li>
        <li><strong>Professional:</strong> ${booking.professional_name}</li>
        <li><strong>Type:</strong> ${booking.visit_type === 'virtual' ? 'Virtual Visit' : 'In-Person'}</li>
      </ul>
      <p>If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
      <p>Thank you for choosing us!</p>
    `,
  }),

  reminder_24h: (booking: any) => ({
    subject: `Reminder: Appointment Tomorrow - ${format(new Date(booking.date), 'MMMM d')}`,
    html: `
      <h2>Appointment Reminder</h2>
      <p>Hello ${booking.client_name},</p>
      <p>This is a reminder that you have an appointment scheduled for tomorrow:</p>
      <ul>
        <li><strong>Date:</strong> ${format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</li>
        <li><strong>Time:</strong> ${booking.start_time}</li>
        <li><strong>Service:</strong> ${booking.service_name}</li>
      </ul>
      <p>We look forward to seeing you!</p>
    `,
  }),

  reminder_1h: (booking: any) => ({
    subject: `Reminder: Appointment in 1 Hour`,
    html: `
      <h2>Your Appointment is Coming Up!</h2>
      <p>Hello ${booking.client_name},</p>
      <p>Your appointment starts in about 1 hour at ${booking.start_time}.</p>
      <p>See you soon!</p>
    `,
  }),

  cancellation: (booking: any) => ({
    subject: `Booking Cancelled - ${format(new Date(booking.date), 'MMMM d, yyyy')}`,
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hello ${booking.client_name},</p>
      <p>Your appointment scheduled for ${format(new Date(booking.date), 'EEEE, MMMM d, yyyy')} at ${booking.start_time} has been cancelled.</p>
      ${booking.cancellation_reason ? `<p><strong>Reason:</strong> ${booking.cancellation_reason}</p>` : ''}
      <p>If you'd like to reschedule, please visit our booking page.</p>
    `,
  }),
};

// SMS templates
const smsTemplates = {
  confirmation: (booking: any) =>
    `Booking confirmed for ${format(new Date(booking.date), 'MMM d')} at ${booking.start_time}. Service: ${booking.service_name}`,

  reminder_24h: (booking: any) =>
    `Reminder: You have an appointment tomorrow at ${booking.start_time}. Service: ${booking.service_name}`,

  reminder_1h: (booking: any) =>
    `Your appointment starts in 1 hour at ${booking.start_time}. See you soon!`,

  cancellation: (booking: any) =>
    `Your appointment on ${format(new Date(booking.date), 'MMM d')} at ${booking.start_time} has been cancelled.`,
};

export class NotificationService {
  /**
   * Schedule notifications for a booking
   */
  async scheduleBookingNotifications(bookingId: string, tenantId: string) {
    const booking = await this.getBookingDetails(bookingId);
    if (!booking) return;

    // Get tenant settings for reminder hours
    const tenant = await db.queryOne<{ settings: any }>(
      'SELECT settings FROM tenants WHERE id = $1',
      [tenantId]
    );

    const reminderHours = tenant?.settings?.reminder_hours || [24, 1];

    // Schedule confirmation email immediately
    await this.queueNotification({
      type: 'confirmation',
      channel: 'email',
      booking,
      tenantId,
      scheduledAt: new Date(),
    });

    // Schedule reminders
    const appointmentTime = new Date(`${booking.date}T${booking.start_time}`);

    for (const hours of reminderHours) {
      const reminderTime = addHours(appointmentTime, -hours);

      // Only schedule if reminder time is in the future
      if (reminderTime > new Date()) {
        const type: NotificationType = hours === 24 ? 'reminder_24h' : 'reminder_1h';

        await this.queueNotification({
          type,
          channel: 'email',
          booking,
          tenantId,
          scheduledAt: reminderTime,
        });

        // Also send SMS if phone is available
        if (booking.client_phone) {
          await this.queueNotification({
            type,
            channel: 'sms',
            booking,
            tenantId,
            scheduledAt: reminderTime,
          });
        }
      }
    }
  }

  /**
   * Send cancellation notification
   */
  async sendCancellationNotification(bookingId: string, tenantId: string) {
    const booking = await this.getBookingDetails(bookingId);
    if (!booking) return;

    await this.queueNotification({
      type: 'cancellation',
      channel: 'email',
      booking,
      tenantId,
      scheduledAt: new Date(),
    });
  }

  /**
   * Queue a notification
   */
  private async queueNotification(params: {
    type: NotificationType;
    channel: NotificationChannel;
    booking: any;
    tenantId: string;
    scheduledAt: Date;
  }) {
    const { type, channel, booking, tenantId, scheduledAt } = params;

    const recipient = channel === 'email' ? booking.client_email : booking.client_phone;
    if (!recipient) return;

    const template = channel === 'email' ? emailTemplates[type] : smsTemplates[type];
    const content = typeof template === 'function' ? template(booking) : template;

    // Create notification record
    const notificationId = uuid();
    await db.query(
      `INSERT INTO notifications (id, tenant_id, booking_id, type, channel, recipient, subject, content, status, scheduled_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, NOW(), NOW())`,
      [
        notificationId,
        tenantId,
        booking.id,
        type,
        channel,
        recipient,
        channel === 'email' ? (content as any).subject : null,
        channel === 'email' ? (content as any).html : content,
        scheduledAt,
      ]
    );

    // Add to queue
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());

    await notificationQueue.add('send', {
      notificationId,
      type,
      channel,
      recipient,
      subject: channel === 'email' ? (content as any).subject : undefined,
      content: channel === 'email' ? (content as any).html : content,
      bookingId: booking.id,
      tenantId,
    } as NotificationJobData, { delay });

    logger.info({ notificationId, type, channel, scheduledAt }, 'Notification queued');
  }

  /**
   * Get booking details for notifications
   */
  private async getBookingDetails(bookingId: string) {
    return db.queryOne(
      `SELECT
         b.*,
         s.name as service_name,
         pu.first_name || ' ' || pu.last_name as professional_name,
         cu.first_name || ' ' || cu.last_name as client_name,
         cu.email as client_email,
         cu.phone as client_phone
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN professionals p ON b.professional_id = p.id
       LEFT JOIN users pu ON p.user_id = pu.id
       LEFT JOIN users cu ON b.client_id = cu.id
       WHERE b.id = $1`,
      [bookingId]
    );
  }
}

// Notification worker
export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job) => {
    const { notificationId, channel, recipient, subject, content } = job.data;

    try {
      if (channel === 'email') {
        if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
          throw new Error('SendGrid not configured');
        }

        await sgMail.send({
          to: recipient,
          from: {
            email: env.SENDGRID_FROM_EMAIL,
            name: env.SENDGRID_FROM_NAME || 'Booking Platform',
          },
          subject: subject!,
          html: content,
        });
      } else if (channel === 'sms') {
        if (!twilioClient || !env.TWILIO_PHONE_NUMBER) {
          throw new Error('Twilio not configured');
        }

        await twilioClient.messages.create({
          body: content,
          to: recipient,
          from: env.TWILIO_PHONE_NUMBER,
        });
      }

      // Update notification status
      await db.query(
        `UPDATE notifications SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );

      logger.info({ notificationId, channel }, 'Notification sent');
    } catch (error) {
      // Update notification with error
      await db.query(
        `UPDATE notifications SET status = 'failed', error = $2, updated_at = NOW()
         WHERE id = $1`,
        [notificationId, (error as Error).message]
      );

      throw error;
    }
  },
  { connection: redis }
);

notificationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Notification job failed');
});

export const notificationService = new NotificationService();
