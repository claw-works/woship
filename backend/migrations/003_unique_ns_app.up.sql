-- Prevent duplicate app deployments in the same namespace.
-- Only stopped deployments release the name for reuse.
CREATE UNIQUE INDEX idx_deployments_ns_app_active
ON deployments (namespace, app_name)
WHERE status != 'stopped';
