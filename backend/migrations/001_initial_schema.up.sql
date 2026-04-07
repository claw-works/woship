CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100),
    role          VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE providers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(50) NOT NULL,
    config     JSONB NOT NULL DEFAULT '{}',
    enabled    BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type          VARCHAR(50) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    payload       JSONB NOT NULL DEFAULT '{}',
    created_by    UUID NOT NULL REFERENCES users(id),
    reviewed_by   UUID REFERENCES users(id),
    reject_reason VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deployments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES tickets(id),
    provider_id UUID NOT NULL REFERENCES providers(id),
    namespace   VARCHAR(100) NOT NULL,
    app_name    VARCHAR(100) NOT NULL,
    image       VARCHAR(500) NOT NULL,
    domain      VARCHAR(255),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    logs        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_deployments_updated_at
BEFORE UPDATE ON deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
