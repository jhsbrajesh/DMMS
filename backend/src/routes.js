const express = require("express");
const { pool, query } = require("./db");
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

router.get("/auth/me", authenticate, async (req, res) => res.json({ user: req.user }));

router.get("/offices", authenticate, async (req, res, next) => {
  try {
    const result = await query("SELECT id, name, code, parent_office_id, address, active FROM offices WHERE active = TRUE ORDER BY name");
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get("/users", authenticate, async (req, res, next) => {
  try {
    const { officeId } = req.query;
    const params = [];
    let where = "u.active = TRUE";
    if (officeId) { params.push(officeId); where += ` AND u.office_id = $${params.length}`; }
    const result = await query(`
      SELECT u.id, u.username, u.full_name, u.mobile, u.email, u.office_id, r.name AS role_name,
             o.name AS office_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN offices o ON o.id = u.office_id
       WHERE ${where}
       ORDER BY u.full_name`, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get("/dashboard/summary", authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'RECEIVED')::int AS received,
             COUNT(*) FILTER (WHERE status = 'FORWARDED')::int AS forwarded,
             COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
             COUNT(*) FILTER (WHERE status = 'DISPOSED')::int AS disposed,
             COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('DISPOSED','CLOSED'))::int AS overdue
        FROM dak`);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get("/dak", authenticate, async (req, res, next) => {
  try {
    const { status, officeId, userId, search, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
    if (officeId) { params.push(officeId); conditions.push(`d.current_office_id = $${params.length}`); }
    if (userId) { params.push(userId); conditions.push(`d.current_user_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(d.dak_number ILIKE $${params.length} OR d.subject ILIKE $${params.length} OR d.sender_name ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
    const limitParam = params.length;
    params.push(Math.max(Number(offset) || 0, 0));
    const offsetParam = params.length;
    const result = await query(`
      SELECT d.*, o.name AS current_office_name, u.full_name AS current_user_name
        FROM dak d
        LEFT JOIN offices o ON o.id = d.current_office_id
        LEFT JOIN users u ON u.id = d.current_user_id
        ${where}
       ORDER BY d.received_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get("/dak/:id", authenticate, async (req, res, next) => {
  try {
    const dakResult = await query(`
      SELECT d.*, o.name AS current_office_name, u.full_name AS current_user_name
        FROM dak d
        LEFT JOIN offices o ON o.id = d.current_office_id
        LEFT JOIN users u ON u.id = d.current_user_id
       WHERE d.id = $1`, [req.params.id]);
    if (!dakResult.rows[0]) return res.status(404).json({ error: "Dak not found" });
    const movements = await query(`
      SELECT m.*, fo.name AS from_office_name, too.name AS to_office_name,
             fu.full_name AS from_user_name, tu.full_name AS to_user_name
        FROM dak_movements m
        LEFT JOIN offices fo ON fo.id = m.from_office_id
        LEFT JOIN offices too ON too.id = m.to_office_id
        LEFT JOIN users fu ON fu.id = m.from_user_id
        LEFT JOIN users tu ON tu.id = m.to_user_id
       WHERE m.dak_id = $1
       ORDER BY m.acted_at DESC`, [req.params.id]);
    res.json({ dak: dakResult.rows[0], movements: movements.rows });
  } catch (err) { next(err); }
});

router.post("/dak", authenticate, requireRole("ADMIN", "OFFICER", "OPERATOR"), async (req, res, next) => {
  try {
    const { dakNumber, subject, senderName, senderAddress, receivedMode, priority, officeId, dueDate, remarks } = req.body || {};
    if (!dakNumber || !subject) return res.status(400).json({ error: "dakNumber and subject are required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(`INSERT INTO dak
        (dak_number, subject, sender_name, sender_address, received_mode, priority, current_office_id, due_date, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'NORMAL'),$7,$8,$9,$10) RETURNING *`,
        [dakNumber, subject, senderName || null, senderAddress || null, receivedMode || null, priority || null, officeId || null, dueDate || null, remarks || null, req.user.sub]);
      const dak = result.rows[0];
      await client.query(`INSERT INTO dak_movements (dak_id, to_office_id, action, remarks) VALUES ($1,$2,'REGISTERED',$3)`, [dak.id, officeId || null, remarks || null]);
      await client.query("COMMIT");
      res.status(201).json(dak);
    } catch (err) { await client.query("ROLLBACK"); throw err; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

router.post("/dak/:id/move", authenticate, requireRole("ADMIN", "OFFICER"), async (req, res, next) => {
  try {
    const { toOfficeId, toUserId, remarks } = req.body || {};
    if (!toOfficeId && !toUserId) return res.status(400).json({ error: "Destination office or user is required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT id, current_office_id, current_user_id FROM dak WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (!current.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Dak not found" }); }
      const d = current.rows[0];
      const office = toOfficeId || d.current_office_id;
      const user = toUserId || null;
      const updated = await client.query(`UPDATE dak
        SET current_office_id = $1, current_user_id = $2, status = 'FORWARDED', updated_at = NOW()
        WHERE id = $3 RETURNING *`, [office, user, d.id]);
      await client.query(`INSERT INTO dak_movements
        (dak_id, from_office_id, to_office_id, from_user_id, to_user_id, action, remarks)
        VALUES ($1,$2,$3,$4,$5,'FORWARDED',$6)`, [d.id, d.current_office_id, office, req.user.officeId || d.current_user_id, user, remarks || null]);
      await client.query("COMMIT");
      res.json(updated.rows[0]);
    } catch (err) { await client.query("ROLLBACK"); throw err; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

router.post("/dak/:id/status", authenticate, requireRole("ADMIN", "OFFICER", "OPERATOR"), async (req, res, next) => {
  try {
    const { status, remarks } = req.body || {};
    const allowed = ["RECEIVED", "PENDING", "FORWARDED", "DISPOSED", "CLOSED"];
    if (!allowed.includes(status)) return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT * FROM dak WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (!current.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Dak not found" }); }
      const d = current.rows[0];
      const updated = await client.query("UPDATE dak SET status=$1, remarks=COALESCE($2, remarks), updated_at=NOW() WHERE id=$3 RETURNING *", [status, remarks || null, d.id]);
      await client.query(`INSERT INTO dak_movements
        (dak_id, from_office_id, to_office_id, from_user_id, to_user_id, action, remarks)
        VALUES ($1,$2,$2,$3,$3,$4,$5)`, [d.id, d.current_office_id, d.current_user_id, status, remarks || null]);
      await client.query("COMMIT");
      res.json(updated.rows[0]);
    } catch (err) { await client.query("ROLLBACK"); throw err; }
    finally { client.release(); }
  } catch (err) { next(err); }
});

module.exports = router;
