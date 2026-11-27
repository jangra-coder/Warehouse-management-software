import { useEffect, useState } from "react";
import { api, money } from "../api";
import Modal from "../components/Modal";

const emptyForm = {
  sku: "", name: "", category: "", make: "", material: "", price: 0,
  low_stock_limit: 5, is_returnable: true, description: "", opening_stock: 0,
};

export default function Products({ canEdit }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState(null); // product being added / edited
  const [stockFor, setStockFor] = useState(null);
  const [viewId, setViewId] = useState(null);

  function load() {
    const q = new URLSearchParams({ search, category, low_only: lowOnly });
    api("/products?" + q).then(setProducts).catch((e) => alert(e.message));
    api("/products/categories").then(setCategories);
  }

  useEffect(load, [search, category, lowOnly]);

  async function remove(p) {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await api("/products/" + p.product_id, "DELETE");
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="page-top">
        <h1>Products</h1>
        {canEdit && <button className="btn" onClick={() => setEditing(emptyForm)}>+ Add Product</button>}
      </div>

      <div className="filters">
        <input placeholder="Search name, SKU or make..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
        </label>
      </div>

      <div className="box">
        <table>
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>Category</th><th>Make</th><th>Price</th>
              <th>New</th><th>Used</th><th>Out</th><th>Type</th><th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.product_id} className={p.on_shelf <= p.low_stock_limit ? "low-row" : ""}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{p.make}</td>
                <td>{money(p.price)}</td>
                <td>{p.new_stock}</td>
                <td>{p.used_stock}</td>
                <td>{p.with_employees + p.with_vendors}</td>
                <td>{p.is_returnable ? "Returnable" : "Consumable"}</td>
                <td className="actions">
                  <button className="small-btn" onClick={() => setViewId(p.product_id)}>View</button>
                  {canEdit && (
                    <>
                      <button className="small-btn" onClick={() => setStockFor(p)}>Stock</button>
                      <button className="small-btn" onClick={() => setEditing(p)}>Edit</button>
                      <button className="small-btn danger" onClick={() => remove(p)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan="10" className="muted">No products found</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductForm product={editing} categories={categories} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
      {stockFor && (
        <StockForm product={stockFor} onClose={() => setStockFor(null)}
          onSaved={() => { setStockFor(null); load(); }} />
      )}
      {viewId && <ProductDetails productId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const isNew = !product.product_id;
  const [form, setForm] = useState({ ...emptyForm, ...product, is_returnable: !!product.is_returnable });
  const [error, setError] = useState("");

  function change(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function save(e) {
    e.preventDefault();
    try {
      const body = { ...form, price: Number(form.price), low_stock_limit: Number(form.low_stock_limit),
        opening_stock: Number(form.opening_stock) };
      if (isNew) await api("/products", "POST", body);
      else await api("/products/" + product.product_id, "PUT", body);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={isNew ? "Add Product" : "Edit Product"} onClose={onClose}>
      <form className="form grid2" onSubmit={save}>
        <div>
          <label>SKU *</label>
          <input value={form.sku} onChange={(e) => change("sku", e.target.value)} />
        </div>
        <div>
          <label>Name *</label>
          <input value={form.name} onChange={(e) => change("name", e.target.value)} />
        </div>
        <div>
          <label>Category *</label>
          <input list="cat-list" value={form.category} onChange={(e) => change("category", e.target.value)} />
          <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label>Make</label>
          <input value={form.make || ""} onChange={(e) => change("make", e.target.value)} />
        </div>
        <div>
          <label>Material</label>
          <input value={form.material || ""} onChange={(e) => change("material", e.target.value)} />
        </div>
        <div>
          <label>Price (₹)</label>
          <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => change("price", e.target.value)} />
        </div>
        <div>
          <label>Low stock alert at</label>
          <input type="number" min="0" value={form.low_stock_limit} onChange={(e) => change("low_stock_limit", e.target.value)} />
        </div>
        {isNew && (
          <div>
            <label>Opening stock (new)</label>
            <input type="number" min="0" value={form.opening_stock} onChange={(e) => change("opening_stock", e.target.value)} />
          </div>
        )}
        <div className="span2">
          <label>Description</label>
          <textarea value={form.description || ""} onChange={(e) => change("description", e.target.value)} />
        </div>
        <label className="check span2">
          <input type="checkbox" checked={form.is_returnable} onChange={(e) => change("is_returnable", e.target.checked)} />
          Returnable (untick for consumables like gloves, oil)
        </label>
        {error && <p className="error span2">{error}</p>}
        <button className="btn span2">Save</button>
      </form>
    </Modal>
  );
}

function StockForm({ product, onClose, onSaved }) {
  const [action, setAction] = useState("add");
  const [stockType, setStockType] = useState("new");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/products/${product.product_id}/stock`, "POST",
        { action, stock_type: stockType, quantity: Number(quantity), notes });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Update stock - " + product.name} onClose={onClose}>
      <p className="muted">Now: new {product.new_stock}, used {product.used_stock}</p>
      <form className="form" onSubmit={save}>
        <label>Add or remove</label>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="add">Add stock (new purchase / found)</option>
          <option value="remove">Remove stock (lost / correction)</option>
        </select>
        <label>Stock type</label>
        <select value={stockType} onChange={(e) => setStockType(e.target.value)}>
          <option value="new">New</option>
          <option value="used">Used</option>
        </select>
        <label>Quantity</label>
        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <label>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. bill no. 123" />
        {error && <p className="error">{error}</p>}
        <button className="btn">Save</button>
      </form>
    </Modal>
  );
}

function ProductDetails({ productId, onClose }) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api("/products/" + productId).then(setData);
    api(`/products/${productId}/history`).then(setHistory);
  }, [productId]);

  if (!data) return null;
  const p = data.product;

  return (
    <Modal title={p.name + " (" + p.sku + ")"} onClose={onClose} wide>
      <div className="cards">
        <div className="card"><span>New</span><b>{p.new_stock}</b></div>
        <div className="card"><span>Used</span><b>{p.used_stock}</b></div>
        <div className="card"><span>With employees</span><b>{p.with_employees}</b></div>
        <div className="card"><span>At vendors</span><b>{p.with_vendors}</b></div>
      </div>

      <h4>Who has it now</h4>
      {data.with_employees.length + data.with_vendors.length === 0 && <p className="muted">Nobody</p>}
      <ul>
        {data.with_employees.map((x) => (
          <li key={"e" + x.tx_id}>{x.employee_name} ({x.emp_code}) - {x.remaining} {x.stock_type}, since {x.created_at}</li>
        ))}
        {data.with_vendors.map((x) => (
          <li key={"v" + x.vtx_id}>{x.vendor_name} - {x.remaining} {x.stock_type} for {x.work_name || "job"}, since {x.created_at}</li>
        ))}
      </ul>

      <h4>Stock history</h4>
      <table>
        <thead>
          <tr><th>Date</th><th>Action</th><th>Qty</th><th>New</th><th>Used</th><th>Notes</th><th>By</th></tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.history_id}>
              <td>{h.created_at}</td>
              <td>{h.action}</td>
              <td>{h.quantity}</td>
              <td>{h.new_before} → {h.new_after}</td>
              <td>{h.used_before} → {h.used_after}</td>
              <td>{h.notes}</td>
              <td>{h.done_by_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
