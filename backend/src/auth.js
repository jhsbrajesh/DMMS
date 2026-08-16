const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

function requireJwtSecret() {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured");
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  requireJwtSecret();
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role_name, officeId: user.office_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authenticate(req, res, next) {
  try {
    requireJwtSecret();
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

async function login(username, password) {
  const result = await query(
    `SELECT u.id, u.username, u.password_hash, u.full_name, u.office_id,
            r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.username = $1 AND u.active = TRUE`,
    [username]
  );

  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) return null;

  await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

  return {
    token: signToken(user),
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_name,
      officeId: user.office_id,
    },
  };
}

module.exports = { hashPassword, login, authenticate, requireRole };
