const express = require("express");
const { query } = require("./db");
const { login, authenticate, requireRole } = require("./auth");

const router = express.Router();

router.post("/auth/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
    const result = await login(username, password);
    if (!result) return res.status(401).json({ error: "Invalid username or password" });
    res.json(result);
  } catch (err) { next(err); }
});

router.get("/auth/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

router.get("/offices", authenticate, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name, code, parent_office_id, address, active FROM offices ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get("/dashboard/summary", authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'RECEIVED')::int AS received,
        COUNT(*) FILTER (WHERE status = 'FORWARDED')::int AS forwarded,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'DISPOSED')::int AS disposed
      FROM dak
    `);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get("/dak", authenticate, async (req, res, next) => {
  try {
    const { status, officeId, search, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
    if (officeId) { params.push(officeId); conditions.push(`d.current_office_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(d.dak_number ILIKE $${params.length} OR d.subject ILIKE $${params.length} OR d.sender_name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Math.min(Number(limit) || 50, 200));
    const limitParam = params.length;
    params.push(Number(offset) || 0);
    const offsetParam = params.length;

    const result = await query(
      `SELECT d.*, o.name AS current_office_name
         FROM dak d
         LEFT JOIN offices o ON o.id = d.current_office_id
         ${where}
        ORDER BY d.received_at DESC
        LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/dak", authenticate, requireRole("ADMIN", "OFFICER", "OPERATOR"), async (req, res, next) => {
  try {
    const { dakNumber, subject, senderName, senderAddress, receivedMode, priority, officeId, dueDate, remarks } = req.body || {};
    if (!dakNumber || !subject) return res.status(400).json({ error: "dakNumber and subject are required" });

    const result = await query(
      `INSERT INTO dak
        (dak_number, subject, sender_name, sender_address, received_mode, priority, current_office_id, due_date, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'NORMAL'),$7,$8,$9,$10)
       RETURNING *`,
      [dakNumber, subject, senderName || null, senderAddress || null, receivedMode || null, priority || null, officeId || null, dueDate || null, remarks || null, req.user.sub]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
