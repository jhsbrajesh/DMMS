const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not configured. Database features will be unavailable until it is set.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function healthCheck() {
  const result = await query("SELECT NOW() AS now");
  return result.rows[0];
}

module.exports = { pool, query, healthCheck };
