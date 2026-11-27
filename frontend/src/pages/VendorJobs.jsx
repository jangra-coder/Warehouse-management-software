import { useEffect, useState } from "react";
import { api, money, today } from "../api";
import Modal from "../components/Modal";

export default function VendorJobs() {
  const [tab, setTab] = useState("send");

  return (
    <div>
      <h1>Vendor Jobs</h1>
      <div className="tabs">
        <button className={tab === "send" ? "active" : ""} onClick={() => setTab("send")}>Send to vendor</button>
        <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Receive / Transfer</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button>
      </div>
      {tab === "send" && <SendTab />}
      {tab === "open" && <OpenJobsTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

function SendTab() {
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [works, setWorks] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [stockType, setStockType] = useState("new");
  const [qty, setQty] = useState(1);
  const [workName, setWorkName] = useState("");
  const [returnDate, setReturnDate] = useState(today(7));
  const [list, setList] = useState([]);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");

  function loadProducts() {
    api("/products").then(setProducts);
  }

  useEffect(() => {
    api("/vendors?active_only=true").then(setVendors);
    loadProducts();
  }, []);

  // when vendor changes, load the works of that vendor
  useEffect(() => {
    setWorks([]);
    setWorkName("");
    setList([]);
    if (vendorId) api(`/vendors/${vendorId}/works`).then(setWorks);
  }, [vendorId]);

  function addToList() {
    setMsg("");
    if (!vendorId) return setMsg("Select a vendor first");
    const p = products.find((x) => x.product_id === Number(productId));
    if (!p) return setMsg("Select a product");
    const available = stockType === "new" ? p.new_stock : p.used_stock;
    if (Number(qty) < 1 || Number(qty) > available) return setMsg(`Quantity must be 1 to ${available}`);
    const work = works.find((w) => w.work_name === workName);
    setList([...list, {
      product_id: p.product_id, name: p.name, stock_type: stockType, quantity: Number(qty),
      work_name: workName, price: work ? work.price : 0, expected_return: returnDate,
    }]);
    setQty(1);
  }

  async function send() {
    setMsg("");
    if (list.length === 0) return setMsg("Add at least one item");
    try {
      const items = list.map((l) => ({
        product_id: l.product_id, quantity: l.quantity, stock_type: l.stock_type,
        work_name: l.work_name, expected_return: l.expected_return,
      }));
      const res = await api("/vendor-jobs/send", "POST", { vendor_id: Number(vendorId), items, notes });
      alert(res.message);
      setList([]);
      setNotes("");
      loadProducts();
    } catch (err) {
      setMsg(err.message);
    }
  }

  const total = list.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return (
    <div className="two-col">
      <div className="box form">
        <label>Vendor</label>
        <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">-- select vendor --</option>
          {vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.name} ({v.vendor_code})</option>)}
        </select>

        <label>Product</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">-- select product --</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku}) - new {p.new_stock}, used {p.used_stock}</option>
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

        <label>Work</label>
        <select value={workName} onChange={(e) => setWorkName(e.target.value)}>
          <option value="">-- no work selected --</option>
          {works.map((w) => <option key={w.work_id} value={w.work_name}>{w.work_name} ({money(w.price)} each)</option>)}
        </select>

        <label>Expected return date</label>
        <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />

        <button className="btn secondary" onClick={addToList}>Add to list</button>
      </div>

      <div className="box">
        <h3>Items to send</h3>
        <table>
          <thead><tr><th>Product</th><th>Qty</th><th>Work</th><th>Return by</th><th></th></tr></thead>
          <tbody>
            {list.map((l, i) => (
              <tr key={i}>
                <td>{l.name} <span className="muted">({l.stock_type})</span></td>
                <td>{l.quantity}</td>
                <td>{l.work_name || "-"} {l.price ? money(l.price * l.quantity) : ""}</td>
                <td>{l.expected_return}</td>
                <td><button className="small-btn danger" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="5" className="muted">List is empty</td></tr>}
          </tbody>
        </table>
        <p>Job cost: <b>{money(total)}</b></p>
        <div className="form">
          <label>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          {msg && <p className="error">{msg}</p>}
          <button className="btn" onClick={send}>Send to vendor</button>
        </div>
      </div>
    </div>
  );
}

function OpenJobsTab() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [receiving, setReceiving] = useState(null);
  const [moving, setMoving] = useState(null);

  function load() {
    api("/vendor-jobs/open?search=" + encodeURIComponent(search)).then(setRows);
  }

  useEffect(load, [search]);

  return (
    <div>
      <div className="filters">
        <input placeholder="Search vendor or product..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="box">
        <table>
          <thead>
            <tr><th>#</th><th>Vendor</th><th>Product</th><th>Qty at vendor</th><th>Work</th><th>Sent on</th><th>Return by</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vtx_id}>
                <td>{r.vtx_id}</td>
                <td>{r.vendor_name}</td>
                <td>{r.product_name} <span className="muted">({r.stock_type})</span></td>
                <td>{r.remaining}</td>
                <td>{r.work_name || "-"}</td>
                <td>{r.created_at}</td>
                <td className={r.is_late ? "red" : ""}>{r.expected_return || "-"} {r.is_late ? "(late)" : ""}</td>
                <td className="actions">
                  <button className="small-btn" onClick={() => setReceiving(r)}>Receive</button>
                  <button className="small-btn" onClick={() => setMoving(r)}>Transfer</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="8" className="muted">No items are at vendors</td></tr>}
          </tbody>
        </table>
      </div>
      {receiving && <ReceiveForm row={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); load(); }} />}
      {moving && <VendorTransferForm row={moving} onClose={() => setMoving(null)} onDone={() => { setMoving(null); load(); }} />}
    </div>
  );
}

function ReceiveForm({ row, onClose, onDone }) {
  const [qty, setQty] = useState(row.remaining);
  const [condition, setCondition] = useState("good");
  const [amount, setAmount] = useState(row.work_price * row.remaining);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function changeQty(value) {
    setQty(value);
    setAmount(row.work_price * Number(value || 0));
  }

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/vendor-jobs/${row.vtx_id}/receive`, "POST",
        { quantity: Number(qty), condition, amount_paid: Number(amount || 0), notes });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Receive - " + row.product_name} onClose={onClose}>
      <p className="muted">{row.vendor_name} has {row.remaining} for {row.work_name || "job"}</p>
      <form className="form" onSubmit={save}>
        <label>Quantity</label>
        <input type="number" min="1" max={row.remaining} value={qty} onChange={(e) => changeQty(e.target.value)} />
        <label>Condition</label>
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="good">Good - back to {row.stock_type} stock</option>
          <option value="damaged">Damaged - goes to used stock</option>
          <option value="consumed">Consumed - not back in stock</option>
        </select>
        <label>Amount paid (₹)</label>
        <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn">Receive</button>
      </form>
    </Modal>
  );
}

function VendorTransferForm({ row, onClose, onDone }) {
  const [vendors, setVendors] = useState([]);
  const [works, setWorks] = useState([]);
  const [toId, setToId] = useState("");
  const [workName, setWorkName] = useState("");
  const [qty, setQty] = useState(row.remaining);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/vendors?active_only=true").then((list) => setVendors(list.filter((v) => v.vendor_id !== row.vendor_id)));
  }, [row]);

  useEffect(() => {
    setWorks([]);
    setWorkName("");
    if (toId) api(`/vendors/${toId}/works`).then(setWorks);
  }, [toId]);

  async function save(e) {
    e.preventDefault();
    if (!toId) return setError("Select a vendor");
    try {
      await api(`/vendor-jobs/${row.vtx_id}/transfer`, "POST",
        { to_vendor_id: Number(toId), quantity: Number(qty), work_name: workName, notes });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Move to another vendor - " + row.product_name} onClose={onClose}>
      <p className="muted">From {row.vendor_name} (has {row.remaining})</p>
      <form className="form" onSubmit={save}>
        <label>To vendor</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">-- select --</option>
          {vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}
        </select>
        <label>Work at new vendor</label>
        <select value={workName} onChange={(e) => setWorkName(e.target.value)}>
          <option value="">-- no work selected --</option>
          {works.map((w) => <option key={w.work_id} value={w.work_name}>{w.work_name} ({money(w.price)})</option>)}
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
    api("/vendor-jobs?" + q).then(setRows);
  }, [search, type]);

  return (
    <div>
      <div className="filters">
        <input placeholder="Search vendor or product..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="SEND">Send</option>
          <option value="RECEIVE">Receive</option>
          <option value="TRANSFER">Transfer</option>
        </select>
      </div>
      <div className="box">
        <table>
          <thead>
            <tr><th>#</th><th>Date</th><th>Type</th><th>Vendor</th><th>Product</th><th>Qty</th><th>Work</th><th>Condition</th><th>Paid</th><th>By</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vtx_id}>
                <td>{r.vtx_id}</td>
                <td>{r.created_at}</td>
                <td><span className={"tag " + r.tx_type.toLowerCase()}>{r.tx_type}</span></td>
                <td>{r.vendor_name}</td>
                <td>{r.product_name}</td>
                <td>{r.quantity}</td>
                <td>{r.work_name}</td>
                <td>{r.item_condition}</td>
                <td>{r.tx_type === "RECEIVE" ? money(r.amount_paid) : ""}</td>
                <td>{r.done_by_name}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="10" className="muted">No vendor jobs</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
