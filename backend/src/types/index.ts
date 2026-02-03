import { Request } from 'express';

// Roles del sistema
export type UserRole = 'super_admin' | 'tenant_admin' | 'staff' | 'client';

// Estados de reserva
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// Estados de slot
export type SlotStatus = 'available' | 'locked' | 'booked' | 'blocked';

// Estados de pago
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// Proveedores de pago
export type PaymentProvider = 'stripe' | 'mercadopago';

// Canales de notificación
export type NotificationChannel = 'email' | 'sms';

// Tipos de notificación
export type NotificationType = 'confirmation' | 'reminder_24h' | 'reminder_1h' | 'cancellation';

// Tipo de visita
export type VisitType = 'in_person' | 'virtual';

// Entidad base
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// Tenant
export interface Tenant extends BaseEntity {
  name: string;
  slug: string;
  subdomain: string;
  settings: TenantSettings;
  subscription_plan: string;
  stripe_customer_id: string | null;
  is_active: boolean;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  locale: string;
  booking_advance_days: number;
  cancellation_hours: number;
  reminder_hours: number[];
  payment_required: boolean;
  allow_virtual_visits: boolean;
}

// Usuario
export interface User extends BaseEntity {
  tenant_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: Date | null;
}

// Servicio
export interface Service extends BaseEntity {
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  is_active: boolean;
}

// Profesional
export interface Professional extends BaseEntity {
  tenant_id: string;
  user_id: string;
  specialization: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

// Regla de disponibilidad
export interface AvailabilityRule extends BaseEntity {
  tenant_id: string;
  professional_id: string;
  day_of_week: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  is_active: boolean;
}

// Excepción de disponibilidad
export interface AvailabilityException extends BaseEntity {
  professional_id: string;
  date: Date;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

// Time Slot
export interface TimeSlot extends BaseEntity {
  professional_id: string;
  service_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  locked_by: string | null;
  locked_until: Date | null;
}

// Reserva
export interface Booking extends BaseEntity {
  tenant_id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  time_slot_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  visit_type: VisitType;
  notes: string | null;
  payment_status: PaymentStatus;
  payment_id: string | null;
  total_amount: number;
  currency: string;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
}

// Pago
export interface Payment extends BaseEntity {
  tenant_id: string;
  booking_id: string;
  provider: PaymentProvider;
  provider_payment_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata: Record<string, any>;
  refunded_amount: number;
  refunded_at: Date | null;
}

// Notificación
export interface Notification extends BaseEntity {
  tenant_id: string;
  booking_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  scheduled_at: Date;
  sent_at: Date | null;
  error: string | null;
}

// Suscripción
export interface Subscription extends BaseEntity {
  tenant_id: string;
  plan: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  stripe_subscription_id: string | null;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
}

// Request extendido
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    tenant_id: string;
  };
  tenant?: Tenant;
}

// Respuesta de API estándar
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Parámetros de paginación
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
