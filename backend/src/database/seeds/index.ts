import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting seed...\n');

    await client.query('BEGIN');

    // 1. Create demo tenant
    const tenantId = uuid();
    await client.query(
      `INSERT INTO tenants (id, name, slug, subdomain, subscription_plan)
       VALUES ($1, 'Demo Clinic', 'demo-clinic', 'demo', 'professional')
       ON CONFLICT (slug) DO NOTHING`,
      [tenantId]
    );
    console.log('✅ Created demo tenant');

    // 2. Create super admin (password: admin123)
    const superAdminId = uuid();
    const adminPassword = await bcrypt.hash('admin123', 12);
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, is_active, email_verified)
       VALUES ($1, $2, 'admin@demo.com', $3, 'super_admin', 'Super', 'Admin', true, true)
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [superAdminId, tenantId, adminPassword]
    );
    console.log('✅ Created super admin (admin@demo.com / admin123)');

    // 3. Create tenant admin (password: demo123)
    const tenantAdminId = uuid();
    const tenantAdminPassword = await bcrypt.hash('demo123', 12);
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, is_active, email_verified)
       VALUES ($1, $2, 'manager@demo.com', $3, 'tenant_admin', 'Demo', 'Manager', true, true)
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [tenantAdminId, tenantId, tenantAdminPassword]
    );
    console.log('✅ Created tenant admin (manager@demo.com / demo123)');

    // 4. Create services
    const services = [
      { name: 'General Consultation', description: 'Standard medical consultation', duration: 30, price: 150 },
      { name: 'Specialty Screening', description: 'Comprehensive health screening', duration: 60, price: 280 },
      { name: 'Follow-up Visit', description: 'Follow-up appointment', duration: 15, price: 85 },
      { name: 'Wellness Check', description: 'Annual wellness examination', duration: 45, price: 200 },
    ];

    const serviceIds: string[] = [];
    for (const service of services) {
      const serviceId = uuid();
      serviceIds.push(serviceId);
      await client.query(
        `INSERT INTO services (id, tenant_id, name, description, duration_minutes, price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [serviceId, tenantId, service.name, service.description, service.duration, service.price]
      );
    }
    console.log('✅ Created 4 services');

    // 5. Create professionals
    const professionals = [
      { firstName: 'Sarah', lastName: 'Smith', email: 'sarah@demo.com', specialization: 'General Practice' },
      { firstName: 'Michael', lastName: 'Chen', email: 'michael@demo.com', specialization: 'Internal Medicine' },
      { firstName: 'Emily', lastName: 'Brooks', email: 'emily@demo.com', specialization: 'Pediatrics' },
    ];

    const staffPassword = await bcrypt.hash('staff123', 12);
    const professionalIds: string[] = [];

    for (const prof of professionals) {
      const userId = uuid();
      const professionalId = uuid();
      professionalIds.push(professionalId);

      await client.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, is_active, email_verified)
         VALUES ($1, $2, $3, $4, 'staff', $5, $6, true, true)`,
        [userId, tenantId, prof.email, staffPassword, prof.firstName, prof.lastName]
      );

      await client.query(
        `INSERT INTO professionals (id, tenant_id, user_id, specialization)
         VALUES ($1, $2, $3, $4)`,
        [professionalId, tenantId, userId, prof.specialization]
      );

      // Associate with all services
      for (const serviceId of serviceIds) {
        await client.query(
          `INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)`,
          [professionalId, serviceId]
        );
      }
    }
    console.log('✅ Created 3 professionals');

    // 6. Create availability rules (Monday-Friday, 9 AM - 5 PM)
    for (const professionalId of professionalIds) {
      for (let day = 1; day <= 5; day++) { // Monday to Friday
        await client.query(
          `INSERT INTO availability_rules (id, tenant_id, professional_id, day_of_week, start_time, end_time)
           VALUES ($1, $2, $3, $4, '09:00', '17:00')`,
          [uuid(), tenantId, professionalId, day]
        );
      }
    }
    console.log('✅ Created availability rules (Mon-Fri 9AM-5PM)');

    // 7. Create sample client
    const clientId = uuid();
    const clientPassword = await bcrypt.hash('client123', 12);
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, email_verified)
       VALUES ($1, $2, 'john@example.com', $3, 'client', 'John', 'Doe', '+1234567890', true, true)`,
      [clientId, tenantId, clientPassword]
    );
    console.log('✅ Created sample client (john@example.com / client123)');

    // 8. Create sample bookings
    const today = new Date();
    const bookings = [
      { daysFromNow: 1, time: '09:00', status: 'confirmed' },
      { daysFromNow: 1, time: '10:00', status: 'pending' },
      { daysFromNow: 2, time: '14:00', status: 'confirmed' },
      { daysFromNow: 3, time: '11:00', status: 'pending' },
    ];

    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      const bookingDate = new Date(today);
      bookingDate.setDate(today.getDate() + booking.daysFromNow);

      // Skip weekends
      while (bookingDate.getDay() === 0 || bookingDate.getDay() === 6) {
        bookingDate.setDate(bookingDate.getDate() + 1);
      }

      const dateStr = bookingDate.toISOString().split('T')[0];
      const service = services[i % services.length];
      const endHour = parseInt(booking.time.split(':')[0]) + Math.ceil(service.duration / 60);
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;

      await client.query(
        `INSERT INTO bookings (id, tenant_id, client_id, professional_id, service_id, date, start_time, end_time, status, visit_type, total_amount, currency, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'in_person', $10, 'USD', 'pending')`,
        [
          uuid(),
          tenantId,
          clientId,
          professionalIds[i % professionalIds.length],
          serviceIds[i % serviceIds.length],
          dateStr,
          booking.time,
          endTime,
          booking.status,
          service.price,
        ]
      );
    }
    console.log('✅ Created 4 sample bookings');

    await client.query('COMMIT');

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('Test accounts:');
    console.log('  Super Admin: admin@demo.com / admin123');
    console.log('  Tenant Admin: manager@demo.com / demo123');
    console.log('  Staff: sarah@demo.com / staff123');
    console.log('  Client: john@example.com / client123');
    console.log('\nTenant subdomain: demo');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
