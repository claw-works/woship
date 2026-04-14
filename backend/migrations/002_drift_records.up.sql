CREATE TABLE drift_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployments(id),
    plan_output   TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'detected',
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drift_records_deployment ON drift_records(deployment_id);
CREATE INDEX idx_drift_records_status ON drift_records(status);

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS drift_status VARCHAR(20) NOT NULL DEFAULT 'clean';
