import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function Scrap({ canEdit }) {
  const [data, setData] = useState({ rows: [], total_qty: 0, total_weight: 0 });
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    api("/scrap?search=" + encodeURIComponent(search)).then(setData);
  }

  useEffect(load, [search]);

  return (
    <div>
      <div className="page-top">
        <h1>Scrap</h1>
        {canEdit && <button className="btn" onClick={() => setAdding(true)}>+ Add Scrap</button>}
      </div>

      <div className="cards">
        <div className="card"><span>Records</span><b>{data.rows.length}</b></div>
        <div className="card"><span>Total quantity</span><b>{data.total_qty}</b></div>
        <div className="card"><span>Total weight</span><b>{data.total_weight} kg</b></div>
      </div>

      <div className="filters">
        <input placeholder="Search product or reason..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="box">
        <table>
          <thead>
            <tr><th>#</th><th>Date</th><th>Product</th><th>Category</th><th>Stock</th><th>Qty</th><th>Weight (kg)</th><th>Reason</th><th>By</th></tr>
          </thead>
          <tbody>
            {data.rows.map((s) => (
              <tr key={s.scrap_id}>
                <td>{s.scrap_id}</td>
                <td>{s.created_at}</td>
                <td>{s.product_name} <span className="muted">{s.sku}</span></td>
                <td>{s.category}</td>
                <td>{s.stock_type}</td>
                <td>{s.quantity}</td>
                <td>{s.weight_kg ?? "-"}</td>
                <td>{s.reason}</td>
                <td>{s.done_by_name}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan="9" className="muted">No scrap yet</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && <AddScrap onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddScrap({ onClose, onDone }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [stockType, setStockType] = useState("used");
  const [qty, setQty] = useState(1);
  const [weight, setWeight] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/products").then(setProducts);
  }, []);

  async function save(e) {
    e.preventDefault();
    if (!productId) return setError("Select a product");
    try {
      await api("/scrap", "POST", {
        product_id: Number(productId), stock_type: stockType, quantity: Number(qty),
        weight_kg: weight === "" ? null : Number(weight), reason,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Add Scrap" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Product</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">-- select product --</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku}) - new {p.new_stock}, used {p.used_stock}</option>
          ))}
        </select>
        <label>From stock</label>
        <select value={stockType} onChange={(e) => setStockType(e.target.value)}>
          <option value="used">Used</option>
          <option value="new">New</option>
        </select>
        <label>Quantity</label>
        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        <label>Weight in kg (optional)</label>
        <input type="number" min="0" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <label>Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. broken edge" />
        {error && <p className="error">{error}</p>}
        <button className="btn danger">Mark as scrap</button>
      </form>
    </Modal>
  );
}
