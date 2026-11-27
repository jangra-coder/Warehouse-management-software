import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function Employees({ canEdit }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewId, setViewId] = useState(null);

  function load() {
    api("/employees?search=" + encodeURIComponent(search)).then(setList).catch((e) => alert(e.message));
  }

  useEffect(load, [search]);

  async function remove(emp) {
    if (!confirm(`Delete ${emp.name}?`)) return;
    try {
      await api("/employees/" + emp.employee_id, "DELETE");
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="page-top">
        <h1>Employees</h1>
        {canEdit && <button className="btn" onClick={() => setEditing({})}>+ Add Employee</button>}
      </div>
      <div className="filters">
        <input placeholder="Search name, code or department..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="box">
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Department</th><th>Phone</th><th>Items with them</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.employee_id} className={e.is_active ? "" : "faded"}>
                <td>{e.emp_code}</td>
                <td>{e.name}</td>
                <td>{e.department}</td>
                <td>{e.phone}</td>
                <td>{e.items_out}</td>
                <td>{e.is_active ? "Active" : "Inactive"}</td>
                <td className="actions">
                  <button className="small-btn" onClick={() => setViewId(e.employee_id)}>View</button>
                  {canEdit && (
                    <>
                      <button className="small-btn" onClick={() => setEditing(e)}>Edit</button>
                      <button className="small-btn danger" onClick={() => remove(e)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="muted">No employees found</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <EmployeeForm emp={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {viewId && <EmployeeProfile id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function EmployeeForm({ emp, onClose, onSaved }) {
  const isNew = !emp.employee_id;
  const [form, setForm] = useState({
    emp_code: emp.emp_code || "", name: emp.name || "", department: emp.department || "",
    phone: emp.phone || "", is_active: isNew ? true : !!emp.is_active,
  });
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      if (isNew) await api("/employees", "POST", form);
      else await api("/employees/" + emp.employee_id, "PUT", form);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "Add Employee" : "Edit Employee"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Employee code *</label>
        <input value={form.emp_code} onChange={(e) => setForm({ ...form, emp_code: e.target.value })} placeholder="e.g. EMP007" />
        <label>Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label>Department *</label>
        <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <label>Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {!isNew && (
          <label className="check">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn">Save</button>
      </form>
    </Modal>
  );
}

function EmployeeProfile({ id, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api("/employees/" + id).then(setData);
  }, [id]);

  if (!data) return null;
  const e = data.employee;
  const withThem = data.transactions.filter((t) => t.remaining > 0);

  return (
    <Modal title={e.name + " (" + e.emp_code + ")"} onClose={onClose} wide>
      <p>Department: {e.department} | Phone: {e.phone || "-"} | {e.is_active ? "Active" : "Inactive"}</p>

      <h4>Items with this employee now</h4>
      {withThem.length === 0 ? <p className="muted">Nothing</p> : (
        <ul>
          {withThem.map((t) => <li key={t.tx_id}>{t.product_name} ({t.sku}) - {t.remaining} {t.stock_type}, since {t.created_at}</li>)}
        </ul>
      )}

      <h4>History</h4>
      <table>
        <thead>
          <tr><th>#</th><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Condition</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {data.transactions.map((t) => (
            <tr key={t.tx_id}>
              <td>{t.tx_id}</td>
              <td>{t.created_at}</td>
              <td><span className={"tag " + t.tx_type.toLowerCase()}>{t.tx_type}</span></td>
              <td>{t.product_name}</td>
              <td>{t.quantity}</td>
              <td>{t.item_condition}</td>
              <td>{t.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
