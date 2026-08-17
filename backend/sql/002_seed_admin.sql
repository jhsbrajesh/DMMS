-- Run this after 001_initial_schema.sql.
-- Replace the password hash with a bcrypt hash generated for your chosen admin password.
-- Example generation: node -e "require('bcrypt').hash('CHANGE_ME',12).then(console.log)"

INSERT INTO offices (name, code, address)
VALUES ('District Office', 'DISTRICT', 'Lalitpur, Uttar Pradesh')
ON CONFLICT (code) DO NOTHING;

-- Example admin user. Keep disabled until a real password hash is supplied.
-- INSERT INTO users (username, password_hash, full_name, role_id, office_id)
-- SELECT 'admin', '<BCRYPT_HASH>', 'DMMS Administrator', r.id, o.id
-- FROM roles r, offices o
-- WHERE r.name = 'ADMIN' AND o.code = 'DISTRICT';
