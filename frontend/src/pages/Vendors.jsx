import { useEffect, useState } from "react";
import { api, money } from "../api";
import Modal from "../components/Modal";

export default function Vendors({ canEdit }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewId, setViewId] = useState(null);

  function load() {
    api("/vendors?search=" + encodeURIComponent(search)).then(setList).catch((e) => alert(e.message));
  }

  useEffect(load, [search]);

  async function remove(v) {
    if (!confirm(`Delete ${v.name}?`)) return;
    try {
      await api("/vendors/" + v.vendor_id, "DELETE");
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="page-top">
        <h1>Vendors</h1>
        {canEdit && <button className="btn" onClick={() => setEditing({})}>+ Add Vendor</button>}
      </div>
      <div className="filters">
        <input placeholder="Search name, code or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="box">
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Phone</th><th>Address</th><th>Items at vendor</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.vendor_id} className={v.is_active ? "" : "faded"}>
                <td>{v.vendor_code}</td>
                <td>{v.name}</td>
                <td>{v.phone}</td>
                <td>{v.address}</td>
                <td>{v.items_out}</td>
                <td>{v.is_active ? "Active" : "Inactive"}</td>
                <td className="actions">
                  <button className="small-btn" onClick={() => setViewId(v.vendor_id)}>View / Works</button>
                  {canEdit && (
                    <>
                      <button className="small-btn" onClick={() => setEditing(v)}>Edit</button>
                      <button className="small-btn danger" onClick={() => remove(v)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="muted">No vendors found</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <VendorForm vendor={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {viewId && <VendorProfile id={viewId} canEdit={canEdit} onClose={() => setViewId(null)} />}
    </div>
  );
}

function VendorForm({ vendor, onClose, onSaved }) {
  const isNew = !vendor.vendor_id;
  const [form, setForm] = useState({
    vendor_code: vendor.vendor_code || "", name: vendor.name || "", phone: vendor.phone || "",
    address: vendor.address || "", is_active: isNew ? true : !!vendor.is_active,
  });
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      if (isNew) await api("/vendors", "POST", form);
      else await api("/vendors/" + vendor.vendor_id, "PUT", form);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "Add Vendor" : "Edit Vendor"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Vendor code *</label>
        <input value={form.vendor_code} onChange={(e) => setForm({ ...form, vendor_code: e.target.value })} placeholder="e.g. VEN004" />
        <label>Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label>Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label>Address</label>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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

function VendorProfile({ id, canEdit, onClose }) {
  const [data, setData] = useState(null);
  const [workName, setWorkName] = useState("");
  const [price, setPrice] = useState("");

  function load() {
    api("/vendors/" + id).then(setData);
  }

  useEffect(load, [id]);

  async function addWork(e) {
    e.preventDefault();
    try {
      await api(`/vendors/${id}/works`, "POST", { work_name: workName, price: Number(price || 0) });
      setWorkName("");
      setPrice("");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteWork(w) {
    if (!confirm(`Delete work "${w.work_name}"?`)) return;
    await api(`/vendors/${id}/works/${w.work_id}`, "DELETE");
    load();
  }

  if (!data) return null;
  const v = data.vendor;

  return (
    <Modal title={v.name + " (" + v.vendor_code + ")"} onClose={onClose} wide>
      <p>Phone: {v.phone || "-"} | Address: {v.address || "-"}</p>

      <h4>Works (jobs this vendor does)</h4>
      <table>
        <thead><tr><th>Work</th><th>Price per item</th>{canEdit && <th></th>}</tr></thead>
        <tbody>
          {data.works.map((w) => (
            <tr key={w.work_id}>
              <td>{w.work_name}</td>
              <td>{money(w.price)}</td>
              {canEdit && <td><button className="small-btn danger" onClick={() => deleteWork(w)}>Delete</button></td>}
            </tr>
          ))}
          {data.works.length === 0 && <tr><td colSpan="3" className="muted">No works added</td></tr>}
        </tbody>
      </table>
      {canEdit && (
        <form className="inline-form" onSubmit={addWork}>
          <input placeholder="Work name e.g. Re-grinding" value={workName} onChange={(e) => setWorkName(e.target.value)} />
          <input type="number" min="0" step="0.01" placeholder="Price ₹" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn">Add work</button>
        </form>
      )}

      <h4>History</h4>
      <table>
        <thead>
          <tr><th>#</th><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Work</th><th>Paid</th></tr>
        </thead>
        <tbody>
          {data.transactions.map((t) => (
            <tr key={t.vtx_id}>
              <td>{t.vtx_id}</td>
              <td>{t.created_at}</td>
              <td><span className={"tag " + t.tx_type.toLowerCase()}>{t.tx_type}</span></td>
              <td>{t.product_name}</td>
              <td>{t.quantity}</td>
              <td>{t.work_name}</td>
              <td>{t.tx_type === "RECEIVE" ? money(t.amount_paid) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
