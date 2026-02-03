const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
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

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private tenantSlug: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('authToken');
    this.tenantSlug = localStorage.getItem('tenantSlug');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  setTenant(slug: string | null) {
    this.tenantSlug = slug;
    if (slug) {
      localStorage.setItem('tenantSlug', slug);
    } else {
      localStorage.removeItem('tenantSlug');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...(this.tenantSlug && { 'X-Tenant-ID': this.tenantSlug }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw data;
      }

      return data;
    } catch (error: any) {
      if (error?.error) {
        throw error;
      }
      throw {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error. Please check your connection.',
        },
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_URL);

// Auth API
export const authApi = {
  register: (data: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => api.post('/auth/register', data),

  login: (email: string, password: string) =>
    api.post<{
      user: any;
      tenant: any;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', { email, password }),

  getProfile: () => api.get<any>('/auth/profile'),

  refreshToken: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken }),
};

// Public API (no auth required, but needs tenant)
export const publicApi = {
  getTenant: () => api.get<any>('/public/tenant'),

  getServices: () => api.get<any[]>('/public/services'),

  getProfessionals: (serviceId?: string) =>
    api.get<any[]>('/public/professionals', serviceId ? { service_id: serviceId } : undefined),

  getSlots: (professionalId: string, serviceId: string, date: string) =>
    api.get<any[]>('/public/slots', { professional_id: professionalId, service_id: serviceId, date }),

  createBooking: (data: {
    professional_id: string;
    service_id: string;
    date: string;
    start_time: string;
    end_time: string;
    visit_type: 'in_person' | 'virtual';
    notes?: string;
    client_email: string;
    client_name: string;
    client_phone?: string;
  }) => api.post<any>('/public/bookings', data),
};

// Services API (admin)
export const servicesApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<any[]>('/services', params),

  get: (id: string) => api.get<any>(`/services/${id}`),

  create: (data: {
    name: string;
    description?: string;
    duration_minutes: number;
    price: number;
    currency?: string;
  }) => api.post<any>('/services', data),

  update: (id: string, data: Partial<{
    name: string;
    description: string;
    duration_minutes: number;
    price: number;
    is_active: boolean;
  }>) => api.patch<any>(`/services/${id}`, data),

  delete: (id: string) => api.delete(`/services/${id}`),
};

// Professionals API (admin)
export const professionalsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<any[]>('/professionals', params),

  get: (id: string) => api.get<any>(`/professionals/${id}`),

  create: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    specialization?: string;
    bio?: string;
    serviceIds?: string[];
  }) => api.post<any>('/professionals', data),

  update: (id: string, data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    specialization: string;
    bio: string;
    is_active: boolean;
    serviceIds: string[];
  }>) => api.patch<any>(`/professionals/${id}`, data),

  delete: (id: string) => api.delete(`/professionals/${id}`),
};

// Availability API
export const availabilityApi = {
  getRules: (professionalId: string) =>
    api.get<any[]>(`/availability/rules/${professionalId}`),

  createRule: (data: {
    professional_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }) => api.post<any>('/availability/rules', data),

  updateRule: (id: string, data: Partial<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>) => api.patch<any>(`/availability/rules/${id}`, data),

  deleteRule: (id: string) => api.delete(`/availability/rules/${id}`),

  getSlots: (professionalId: string, params: { date: string; service_id?: string }) =>
    api.get<any[]>(`/availability/slots/${professionalId}`, params),
};

// Bookings API (admin)
export const bookingsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    professional_id?: string;
    date?: string;
    from_date?: string;
    to_date?: string;
  }) => api.get<any[]>('/bookings', params),

  get: (id: string) => api.get<any>(`/bookings/${id}`),

  create: (data: {
    professional_id: string;
    service_id: string;
    date: string;
    start_time: string;
    end_time: string;
    visit_type: 'in_person' | 'virtual';
    notes?: string;
    client_email?: string;
    client_name?: string;
    client_phone?: string;
  }) => api.post<any>('/bookings', data),

  update: (id: string, data: Partial<{
    status: string;
    notes: string;
    cancellation_reason: string;
  }>) => api.patch<any>(`/bookings/${id}`, data),

  confirm: (id: string) => api.post<any>(`/bookings/${id}/confirm`),

  cancel: (id: string, reason?: string) =>
    api.post<any>(`/bookings/${id}/cancel`, { reason }),

  reschedule: (id: string, data: {
    date: string;
    start_time: string;
    end_time: string;
  }) => api.post<any>(`/bookings/${id}/reschedule`, data),
};

// Payments API
export const paymentsApi = {
  createStripeIntent: (bookingId: string) =>
    api.post<{ clientSecret: string; amount: number; currency: string }>(
      '/payments/create-intent',
      { booking_id: bookingId }
    ),

  createMercadoPagoPreference: (data: {
    booking_id: string;
    success_url: string;
    failure_url: string;
    pending_url?: string;
  }) => api.post<{ preferenceId: string; initPoint: string; sandboxInitPoint: string }>(
    '/payments/create-preference',
    data
  ),

  getByBooking: (bookingId: string) =>
    api.get<any>(`/payments/booking/${bookingId}`),
};

// Reports API (admin)
export const reportsApi = {
  getDashboard: () => api.get<any>('/reports/dashboard'),

  getBookings: (params?: {
    from_date?: string;
    to_date?: string;
    professional_id?: string;
  }) => api.get<any>('/reports/bookings', params),

  getRevenue: (params?: {
    from_date?: string;
    to_date?: string;
  }) => api.get<any>('/reports/revenue', params),

  export: (params?: {
    from_date?: string;
    to_date?: string;
  }) => api.get<Blob>('/reports/export', params),
};

export default api;
