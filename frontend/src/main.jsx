import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function api(path, options = {}) {
  const token = localStorage.getItem("dmms_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      localStorage.setItem("dmms_token", data.token);
      localStorage.setItem("dmms_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="login-shell">
    <div className="login-card">
      <div className="brand-mark">DM</div>
      <h1>Department Mail Management System</h1>
      <p className="muted">Secure digital Dak management</p>
      <form onSubmit={submit}>
        <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button>
      </form>
    </div>
  </div>;
}

function Dashboard({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [dak, setDak] = useState([]);
  const [offices, setOffices] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ dakNumber: "", subject: "", senderName: "", receivedMode: "EMAIL", priority: "NORMAL", officeId: "", remarks: "" });

  async function load() {
    try {
      const [s, d, o] = await Promise.all([api("/dashboard/summary"), api(`/dak?search=${encodeURIComponent(search)}`), api("/offices")]);
      setSummary(s); setDak(d); setOffices(o); setError("");
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);
  const cards = useMemo(() => summary ? [
    ["Total Dak", summary.total, "total"], ["Received", summary.received, "received"], ["Pending", summary.pending, "pending"], ["Disposed", summary.disposed, "disposed"]
  ] : [], [summary]);

  async function createDak(e) {
    e.preventDefault();
    try { await api("/dak", { method: "POST", body: JSON.stringify(form) }); setShowForm(false); setForm({ dakNumber: "", subject: "", senderName: "", receivedMode: "EMAIL", priority: "NORMAL", officeId: "", remarks: "" }); await load(); }
    catch (err) { setError(err.message); }
  }

  function logout() { localStorage.removeItem("dmms_token"); localStorage.removeItem("dmms_user"); onLogout(); }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-dot">DM</span><span>DMMS</span></div><div className="user-area"><span>{user.fullName || user.username}</span><span className="role">{user.role}</span><button className="ghost" onClick={logout}>Logout</button></div></header>
    <aside className="sidebar"><div className="nav active">▣ Dashboard</div><div className="nav">✉ Inward Dak</div><div className="nav">↗ Outward Dak</div><div className="nav">↔ Dak Movement</div><div className="nav">▤ Reports</div><div className="nav">⚙ Administration</div></aside>
    <main className="content">
      <div className="page-head"><div><h2>Dashboard</h2><p className="muted">Department mail overview and recent Dak</p></div><button className="primary" onClick={() => setShowForm(true)}>+ New Inward Dak</button></div>
      {error && <div className="alert error">{error}</div>}
      <section className="cards">{cards.map(([label, value, type]) => <div className={`stat ${type}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className="panel"><div className="panel-head"><h3>Recent Dak</h3><input className="search" placeholder="Search Dak no., subject or sender" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} /></div><div className="table-wrap"><table><thead><tr><th>Dak No.</th><th>Subject</th><th>Sender</th><th>Received</th><th>Status</th><th>Office</th></tr></thead><tbody>{dak.map(d => <tr key={d.id}><td><b>{d.dak_number}</b></td><td>{d.subject}</td><td>{d.sender_name || "—"}</td><td>{new Date(d.received_at).toLocaleDateString()}</td><td><span className={`badge ${String(d.status).toLowerCase()}`}>{d.status}</span></td><td>{d.current_office_name || "—"}</td></tr>)}{!dak.length && <tr><td colSpan="6" className="empty">No Dak records found.</td></tr>}</tbody></table></div></section>
    </main>
    {showForm && <div className="modal-backdrop"><form className="modal" onSubmit={createDak}><div className="modal-head"><h3>Register Inward Dak</h3><button type="button" className="icon" onClick={() => setShowForm(false)}>×</button></div><div className="form-grid"><label>Dak Number<input required value={form.dakNumber} onChange={e => setForm({...form, dakNumber:e.target.value})} /></label><label>Priority<select value={form.priority} onChange={e => setForm({...form, priority:e.target.value})}><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label><label className="wide">Subject<input required value={form.subject} onChange={e => setForm({...form, subject:e.target.value})} /></label><label>Sender Name<input value={form.senderName} onChange={e => setForm({...form, senderName:e.target.value})} /></label><label>Received Mode<select value={form.receivedMode} onChange={e => setForm({...form, receivedMode:e.target.value})}><option>EMAIL</option><option>POST</option><option>BY_HAND</option><option>PORTAL</option></select></label><label>Office<select value={form.officeId} onChange={e => setForm({...form, officeId:e.target.value})}><option value="">Select office</option>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="wide">Remarks<textarea value={form.remarks} onChange={e => setForm({...form, remarks:e.target.value})} /></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancel</button><button className="primary">Register Dak</button></div></form></div>}
  </div>;
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("dmms_user") || "null"));
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
