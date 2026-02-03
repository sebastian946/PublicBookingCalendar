-- Migration: Create availability tables
-- Description: Availability rules and exceptions

-- Regular availability rules (weekly schedule)
CREATE TABLE IF NOT EXISTS availability_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Exceptions (holidays, vacations, special hours)
CREATE TABLE IF NOT EXISTS availability_exceptions (
    id UUID PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT false, -- false = blocked, true = special hours
    start_time TIME, -- only if is_available = true
    end_time TIME,   -- only if is_available = true
    reason VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_exception_per_date UNIQUE (professional_id, date)
);

-- Indexes
CREATE INDEX idx_availability_rules_tenant_id ON availability_rules(tenant_id);
CREATE INDEX idx_availability_rules_professional_id ON availability_rules(professional_id);
CREATE INDEX idx_availability_rules_day ON availability_rules(professional_id, day_of_week);
CREATE INDEX idx_availability_exceptions_date ON availability_exceptions(professional_id, date);

CREATE TRIGGER update_availability_rules_updated_at
    BEFORE UPDATE ON availability_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_exceptions_updated_at
    BEFORE UPDATE ON availability_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
