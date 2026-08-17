CREATE TABLE IF NOT EXISTS dak_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dak_id UUID NOT NULL REFERENCES dak(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120),
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dak_attachments_dak ON dak_attachments(dak_id);

CREATE TABLE IF NOT EXISTS outward_dak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dak_number VARCHAR(80) UNIQUE NOT NULL,
  reference_dak_id UUID REFERENCES dak(id),
  recipient_name VARCHAR(255) NOT NULL,
  recipient_address TEXT,
  subject VARCHAR(500) NOT NULL,
  dispatch_mode VARCHAR(40) NOT NULL DEFAULT 'POST',
  dispatch_number VARCHAR(120),
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'PREPARED',
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outward_reference ON outward_dak(reference_dak_id);
CREATE INDEX IF NOT EXISTS idx_outward_date ON outward_dak(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_outward_status ON outward_dak(status);
