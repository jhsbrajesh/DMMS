const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { query, pool } = require("../src/db");

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const password = "dmms-ci-test-password";

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  assert.ok(response.ok, `${options.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function seed() {
  const role = (await query("SELECT id FROM roles WHERE name='ADMIN'")).rows[0];
  assert.ok(role, "ADMIN role missing after migrations");
  const office = (await query("SELECT id FROM offices WHERE code='DISTRICT'")).rows[0];
  assert.ok(office, "DISTRICT office missing after migrations");
  const hash = await bcrypt.hash(password, 4);
  await query(`INSERT INTO users(username,password_hash,full_name,role_id,office_id)
    VALUES('ci-admin',$1,'CI Administrator',$2,$3)
    ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,active=TRUE`, [hash, role.id, office.id]);
  return office.id;
}

async function main() {
  const officeId = await seed();
  const health = await request("/health");
  assert.equal(health.database, "OK");

  const login = await request("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ci-admin", password })
  });
  assert.ok(login.token);
  const auth = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };

  const me = await request("/api/auth/me", { headers: auth });
  assert.equal(me.user.username, "ci-admin");

  const suffix = Date.now();
  const dak = await request("/api/dak", {
    method: "POST", headers: auth,
    body: JSON.stringify({ dakNumber: `CI-${suffix}`, subject: "CI workflow test", senderName: "GitHub Actions", receivedMode: "EMAIL", priority: "NORMAL", officeId })
  });
  assert.ok(dak.id);
  assert.equal(dak.status, "RECEIVED");

  const detail = await request(`/api/dak/${dak.id}`, { headers: auth });
  assert.equal(detail.dak.id, dak.id);
  assert.ok(Array.isArray(detail.movements));

  const moved = await request(`/api/dak/${dak.id}/move`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ toOfficeId: officeId, remarks: "CI forwarding test" })
  });
  assert.equal(moved.status, "FORWARDED");

  const disposed = await request(`/api/dak/${dak.id}/status`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ status: "DISPOSED", remarks: "CI disposal test" })
  });
  assert.equal(disposed.status, "DISPOSED");

  const outward = await request("/api/outward", {
    method: "POST", headers: auth,
    body: JSON.stringify({ dakNumber: `OUT-${suffix}`, referenceDakId: dak.id, recipientName: "CI Recipient", subject: "CI outward test", dispatchMode: "POST" })
  });
  assert.equal(outward.status, "PREPARED");

  const dispatched = await request(`/api/outward/${outward.id}/status`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ status: "DISPATCHED" })
  });
  assert.equal(dispatched.status, "DISPATCHED");

  const delivered = await request(`/api/outward/${outward.id}/status`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ status: "DELIVERED" })
  });
  assert.equal(delivered.status, "DELIVERED");

  const report = await request(`/api/reports/dak?status=DISPOSED`, { headers: auth });
  assert.ok(Array.isArray(report));
  assert.ok(report.some(row => row.dak_number === dak.dak_number));

  console.log("DMMS smoke test passed: health -> login -> inward -> detail -> forward -> dispose -> outward -> dispatch -> delivered -> report");
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => { await pool.end(); });
