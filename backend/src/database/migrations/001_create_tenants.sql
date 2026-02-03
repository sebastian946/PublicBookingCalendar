-- Migration: Create tenants table
-- Description: Multi-tenant organizations

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    subdomain VARCHAR(50) UNIQUE NOT NULL,
    settings JSONB NOT NULL DEFAULT '{
        "timezone": "America/New_York",
        "currency": "USD",
        "locale": "en-US",
        "booking_advance_days": 30,
        "cancellation_hours": 24,
        "reminder_hours": [24, 1],
        "payment_required": false,
        "allow_virtual_visits": true
    }',
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
