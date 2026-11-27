import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function IssueReturn() {
  const [tab, setTab] = useState("issue");

  return (
    <div>
      <h1>Issue / Return</h1>
      <div className="tabs">
        <button className={tab === "issue" ? "active" : ""} onClick={() => setTab("issue")}>Issue items</button>
        <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Return / Transfer</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
      </div>
      {tab === "issue" && <IssueTab />}
      {tab === "open" && <OpenItemsTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

function IssueTab() {
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [productId, setProductId] = useState("");
  const [stockType, setStockType] = useState("new");
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  function loadProducts() {
    api("/products").then(setProducts);
  }

  useEffect(() => {
    api("/employees?active_only=true").then(setEmployees);
    loadProducts();
  }, []);

  function addToCart() {
    setMsg("");
    const p = products.find((x) => x.product_id === Number(productId));
    if (!p) return setMsg("Select a product");
    if (qty < 1) return setMsg("Quantity must be at least 1");
    const available = stockType === "new" ? p.new_stock : p.used_stock;
    const already = cart.filter((c) => c.product_id === p.product_id && c.stock_type === stockType)
      .reduce((sum, c) => sum + c.quantity, 0);
    if (Number(qty) + already > available) return setMsg(`Only ${available} ${stockType} in stock`);
    setCart([...cart, { product_id: p.product_id, name: p.name, sku: p.sku, stock_type: stockType, quantity: Number(qty) }]);
    setQty(1);
  }

  async function issue() {
    setMsg("");
    if (!employeeId) return setMsg("Select an employee");
    if (cart.length === 0) return setMsg("Add at least one item");
    try {
      const items = cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, stock_type: c.stock_type }));
      const res = await api("/transactions/issue", "POST", { employee_id: Number(employeeId), items, notes });
      alert(res.message);
      setCart([]);
      setNotes("");
      loadProducts();
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="two-col">
      <div className="box form">
        <label>Employee</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">-- select employee --</option>
          {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.emp_code})</option>)}
        </select>

        <label>Product</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">-- select product --</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>
              {p.name} ({p.sku}) - new {p.new_stock}, used {p.used_stock}
            </option>
          ))}
        </select>

        <div className="row">
          <div>
            <label>Stock type</label>
            <select value={stockType} onChange={(e) => setStockType(e.target.value)}>
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </div>
          <div>
            <label>Quantity</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <button className="btn secondary" onClick={addToCart}>Add to list</button>
      </div>

      <div className="box">
        <h3>Items to issue</h3>
        <table>
          <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th></th></tr></thead>
          <tbody>
            {cart.map((c, i) => (
              <tr key={i}>
                <td>{c.name} <span className="muted">{c.sku}</span></td>
                <td>{c.stock_type}</td>
                <td>{c.quantity}</td>
                <td><button className="small-btn danger" onClick={() => setCart(cart.filter((_, j) => j !== i))}>Remove</button></td>
              </tr>
            ))}
            {cart.length === 0 && <tr><td colSpan="4" className="muted">List is empty</td></tr>}
          </tbody>
        </table>
        <div className="form">
          <label>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          {msg && <p className="error">{msg}</p>}
          <button className="btn" onClick={issue}>Issue all items</button>
          <p className="muted small">All items are saved together. If one item fails, nothing is issued.</p>
        </div>
      </div>
    </div>
  );
}

function OpenItemsTab() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [returning, setReturning] = useState(null);
  const [moving, setMoving] = useState(null);

  function load() {
    api("/transactions/open?search=" + encodeURIComponent(search)).then(setRows);
  }

  useEffect(load, [search]);

  return (
    <div>
      <div className="filters">
        <input placeholder="Search employee or product..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="box">
        <table>
          <thead>
            <tr><th>#</th><th>Employee</th><th>Product</th><th>Type</th><th>With them</th><th>Since</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tx_id}>
                <td>{r.tx_id}</td>
                <td>{r.employee_name} <span className="muted">{r.emp_code}</span></td>
                <td>{r.product_name} <span className="muted">{r.sku}</span></td>
                <td>{r.stock_type}</td>
                <td>{r.remaining}</td>
                <td>{r.created_at}</td>
                <td className="actions">
                  <button className="small-btn" onClick={() => setReturning(r)}>Return</button>
                  <button className="small-btn" onClick={() => setMoving(r)}>Transfer</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7" className="muted">No items are with employees</td></tr>}
          </tbody>
        </table>
      </div>
      {returning && <ReturnForm row={returning} onClose={() => setReturning(null)} onDone={() => { setReturning(null); load(); }} />}
      {moving && <TransferForm row={moving} onClose={() => setMoving(null)} onDone={() => { setMoving(null); load(); }} />}
    </div>
  );
}

function ReturnForm({ row, onClose, onDone }) {
  const [qty, setQty] = useState(row.remaining);
  const [condition, setCondition] = useState("good");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/transactions/${row.tx_id}/return`, "POST", { quantity: Number(qty), condition, notes });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Return - " + row.product_name} onClose={onClose}>
      <p className="muted">{row.employee_name} has {row.remaining} ({row.stock_type})</p>
      <form className="form" onSubmit={save}>
        <label>Quantity</label>
        <input type="number" min="1" max={row.remaining} value={qty} onChange={(e) => setQty(e.target.value)} />
        <label>Condition</label>
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="good">Good - back to {row.stock_type} stock</option>
          <option value="damaged">Damaged / partly used - goes to used stock</option>
          <option value="consumed">Consumed - used up, not back in stock</option>
        </select>
        <label>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn">Return</button>
      </form>
    </Modal>
  );
}

function TransferForm({ row, onClose, onDone }) {
  const [employees, setEmployees] = useState([]);
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState(row.remaining);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/employees?active_only=true").then((list) => setEmployees(list.filter((e) => e.employee_id !== row.employee_id)));
  }, [row]);

  async function save(e) {
    e.preventDefault();
    if (!toId) return setError("Select an employee");
    try {
      await api(`/transactions/${row.tx_id}/transfer`, "POST", { to_employee_id: Number(toId), quantity: Number(qty), notes });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Transfer - " + row.product_name} onClose={onClose}>
      <p className="muted">From {row.employee_name} (has {row.remaining})</p>
      <form className="form" onSubmit={save}>
        <label>To employee</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">-- select --</option>
          {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.emp_code})</option>)}
        </select>
        <label>Quantity</label>
        <input type="number" min="1" max={row.remaining} value={qty} onChange={(e) => setQty(e.target.value)} />
        <label>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn">Transfer</button>
      </form>
    </Modal>
  );
}

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    const q = new URLSearchParams({ search, tx_type: type });
    api("/transactions?" + q).then(setRows);
  }, [search, type]);

  return (
    <div>
      <div className="filters">
        <input placeholder="Search employee or product..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="ISSUE">Issue</option>
          <option value="RETURN">Return</option>
          <option value="TRANSFER">Transfer</option>
        </select>
      </div>
      <div className="box">
        <table>
          <thead>
            <tr><th>#</th><th>Date</th><th>Type</th><th>Employee</th><th>Product</th><th>Qty</th><th>Stock</th><th>Condition</th><th>Ref</th><th>By</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tx_id}>
                <td>{r.tx_id}</td>
                <td>{r.created_at}</td>
                <td><span className={"tag " + r.tx_type.toLowerCase()}>{r.tx_type}</span></td>
                <td>{r.employee_name}</td>
                <td>{r.product_name}</td>
                <td>{r.quantity}</td>
                <td>{r.stock_type}</td>
                <td>{r.item_condition}</td>
                <td>{r.ref_tx_id ? "#" + r.ref_tx_id : ""}</td>
                <td>{r.done_by_name}</td>
                <td>{r.notes}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="11" className="muted">No transactions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
