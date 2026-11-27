import { useEffect, useState } from "react";
import { api } from "../api";

export default function Requests({ canEdit }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("pending");
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ employee_id: "", product_id: "", quantity: 1, stock_type: "new", note: "" });
  const [msg, setMsg] = useState("");

  function load() {
    api("/requests?status=" + status).then(setRows);
  }

  useEffect(load, [status]);

  useEffect(() => {
    api("/employees?active_only=true").then(setEmployees);
    api("/products").then(setProducts);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (!form.employee_id || !form.product_id) return setMsg("Select employee and product");
    try {
      await api("/requests", "POST", {
        ...form, employee_id: Number(form.employee_id), product_id: Number(form.product_id), quantity: Number(form.quantity),
      });
      setForm({ ...form, product_id: "", quantity: 1, note: "" });
      setMsg("Request sent");
      load();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function approve(r) {
    try {
      await api(`/requests/${r.request_id}/approve`, "POST");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function decline(r) {
    const reason = prompt("Reason for declining (optional)");
    if (reason === null) return;
    try {
      await api(`/requests/${r.request_id}/decline`, "POST", { note: reason });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <h1>Requests</h1>

      <div className="box">
        <h3>New request</h3>
        <form className="inline-form" onSubmit={submit}>
          <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">-- employee --</option>
            {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
          </select>
          <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">-- product --</option>
            {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}
          </select>
          <select value={form.stock_type} onChange={(e) => setForm({ ...form, stock_type: e.target.value })}>
            <option value="new">New</option>
            <option value="used">Used</option>
          </select>
          <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={{ width: 80 }} />
          <input placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="btn">Send request</button>
        </form>
        {msg && <p className={msg === "Request sent" ? "success" : "error"}>{msg}</p>}
      </div>

      <div className="tabs">
        {["pending", "approved", "declined", ""].map((s) => (
          <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>
            {s === "" ? "All" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="box">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Date</th><th>Employee</th><th>Product</th><th>Qty</th><th>In stock</th>
              <th>Note</th><th>Status</th><th>Decided by</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.request_id}>
                <td>{r.request_id}</td>
                <td>{r.created_at}</td>
                <td>{r.employee_name} <span className="muted">{r.department}</span></td>
                <td>{r.product_name} <span className="muted">({r.stock_type})</span></td>
                <td>{r.quantity}</td>
                <td className={r.available < r.quantity ? "red" : ""}>{r.available}</td>
                <td>{r.note}</td>
                <td><span className={"tag " + r.status}>{r.status}</span></td>
                <td>{r.decided_by_name}</td>
                <td className="actions">
                  {canEdit && r.status === "pending" && (
                    <>
                      <button className="small-btn" onClick={() => approve(r)}>Approve & Issue</button>
                      <button className="small-btn danger" onClick={() => decline(r)}>Decline</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="10" className="muted">No requests</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
