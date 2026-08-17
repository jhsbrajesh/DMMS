CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE,
  parent_office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  mobile VARCHAR(20),
  email VARCHAR(255),
  role_id UUID NOT NULL REFERENCES roles(id),
  office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dak_number VARCHAR(50) UNIQUE NOT NULL,
  subject VARCHAR(500) NOT NULL,
  sender_name VARCHAR(255),
  sender_address TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_mode VARCHAR(50),
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
  current_office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  current_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  remarks TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dak_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dak_id UUID NOT NULL REFERENCES dak(id) ON DELETE CASCADE,
  from_office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  to_office_id UUID REFERENCES offices(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  remarks TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dak_id UUID NOT NULL REFERENCES dak(id) ON DELETE CASCADE,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150),
  size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dak_status ON dak(status);
CREATE INDEX IF NOT EXISTS idx_dak_received_at ON dak(received_at);
CREATE INDEX IF NOT EXISTS idx_dak_current_office ON dak(current_office_id);
CREATE INDEX IF NOT EXISTS idx_dak_current_user ON dak(current_user_id);
CREATE INDEX IF NOT EXISTS idx_movements_dak ON dak_movements(dak_id);

INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'System administrator'),
  ('OFFICER', 'Department officer'),
  ('OPERATOR', 'Dak entry and processing operator')
ON CONFLICT (name) DO NOTHING;
