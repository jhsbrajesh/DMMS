-- Workflow integrity helpers for Dak movement.
CREATE INDEX IF NOT EXISTS idx_dak_due_date ON dak(due_date);
CREATE INDEX IF NOT EXISTS idx_dak_current_user_status ON dak(current_user_id, status);
CREATE INDEX IF NOT EXISTS idx_users_office_active ON users(office_id, active);
