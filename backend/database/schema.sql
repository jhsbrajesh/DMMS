-- Department Mail Management System (DMMS)
-- Initial PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    parent_office_id UUID REFERENCES offices(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    office_id UUID REFERENCES offices(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(100) UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    designation VARCHAR(150),
    mobile VARCHAR(20),
    email VARCHAR(200) UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'DEALING_ASSISTANT',
    department_id UUID REFERENCES departments(id),
    office_id UUID REFERENCES offices(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('ADMIN','OFFICER','DEALING_ASSISTANT','DATA_ENTRY','VIEWER'))
);

CREATE TABLE IF NOT EXISTS dak_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dak_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    level SMALLINT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dak (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dmms_number VARCHAR(50) NOT NULL UNIQUE,
    diary_number VARCHAR(100),
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    letter_date DATE,
    letter_number VARCHAR(150),
    sender_name VARCHAR(300) NOT NULL,
    sender_address TEXT,
    sender_contact VARCHAR(100),
    subject TEXT NOT NULL,
    category_id UUID REFERENCES dak_categories(id),
    priority_id UUID REFERENCES dak_priorities(id),
    confidentiality VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(40) NOT NULL DEFAULT 'RECEIVED',
    current_holder_id UUID REFERENCES users(id),
    current_department_id UUID REFERENCES departments(id),
    current_office_id UUID REFERENCES offices(id),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT dak_confidentiality_check CHECK (confidentiality IN ('NORMAL','CONFIDENTIAL','SECRET')),
    CONSTRAINT dak_status_check CHECK (status IN ('RECEIVED','REGISTERED','FORWARDED','UNDER_PROCESS','REPLY_REQUIRED','REPLIED','DISPOSED','CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_dak_receipt_date ON dak(receipt_date);
CREATE INDEX IF NOT EXISTS idx_dak_status ON dak(status);
CREATE INDEX IF NOT EXISTS idx_dak_current_holder ON dak(current_holder_id);
CREATE INDEX IF NOT EXISTS idx_dak_department ON dak(current_department_id);
CREATE INDEX IF NOT EXISTS idx_dak_subject ON dak USING GIN (to_tsvector('simple', subject));

CREATE TABLE IF NOT EXISTS dak_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dak_id UUID NOT NULL REFERENCES dak(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    from_department_id UUID REFERENCES departments(id),
    to_department_id UUID REFERENCES departments(id),
    action VARCHAR(50) NOT NULL DEFAULT 'FORWARDED',
    remarks TEXT,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    CONSTRAINT dak_movement_action_check CHECK (action IN ('FORWARDED','RECEIVED','RETURNED','PUT_UP','APPROVED','REJECTED','REPLIED','DISPOSED'))
);

CREATE INDEX IF NOT EXISTS idx_dak_movements_dak ON dak_movements(dak_id);
CREATE INDEX IF NOT EXISTS idx_dak_movements_to_user ON dak_movements(to_user_id);

CREATE TABLE IF NOT EXISTS dak_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dak_id UUID NOT NULL REFERENCES dak(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    remarks TEXT,
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dak_actions_dak ON dak_actions(dak_id);

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dak_id UUID NOT NULL REFERENCES dak(id) ON DELETE CASCADE,
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500) NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(150),
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_dak ON attachments(dak_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dak_id UUID REFERENCES dak(id) ON DELETE CASCADE,
    title VARCHAR(250) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Initial master data
INSERT INTO dak_categories (name) VALUES
    ('GENERAL'), ('GOVERNMENT'), ('COURT'), ('RTI'), ('COMPLAINT'), ('PERSONAL'), ('OTHER')
ON CONFLICT (name) DO NOTHING;

INSERT INTO dak_priorities (name, level) VALUES
    ('NORMAL', 1), ('URGENT', 2), ('TOP_PRIORITY', 3)
ON CONFLICT (name) DO NOTHING;
