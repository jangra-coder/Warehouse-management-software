import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { api, downloadCsv, money } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const TYPES = ["ISSUE", "RETURN", "TRANSFER", "SEND", "RECEIVE"];

export default function Reports() {
  const [filters, setFilters] = useState({
    from_date: "", to_date: "", source: "", tx_type: "", category: "", group_by: "",
  });
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/products/categories").then(setCategories);
  }, []);

  function change(field, value) {
    setFilters({ ...filters, [field]: value });
  }

  function query() {
    return new URLSearchParams(filters).toString();
  }

  async function generate(e) {
    e.preventDefault();
    setError("");
    try {
      setResult(await api("/reports?" + query()));
    } catch (err) {
      setError(err.message);
    }
  }

  const grouped = result && filters.group_by && result.rows.length > 0 && "group_name" in result.rows[0];

  return (
    <div>
      <h1>Reports</h1>

      <form className="box filters" onSubmit={generate}>
        <div>
          <label>From</label>
          <input type="date" value={filters.from_date} onChange={(e) => change("from_date", e.target.value)} />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={filters.to_date} onChange={(e) => change("to_date", e.target.value)} />
        </div>
        <div>
          <label>Source</label>
          <select value={filters.source} onChange={(e) => change("source", e.target.value)}>
            <option value="">Employees + Vendors</option>
            <option value="Employee">Employees</option>
            <option value="Vendor">Vendors</option>
          </select>
        </div>
        <div>
          <label>Type</label>
          <select value={filters.tx_type} onChange={(e) => change("tx_type", e.target.value)}>
            <option value="">All</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label>Category</label>
          <select value={filters.category} onChange={(e) => change("category", e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>Group by</label>
          <select value={filters.group_by} onChange={(e) => change("group_by", e.target.value)}>
            <option value="">No grouping</option>
            <option value="category">Category</option>
            <option value="product">Product</option>
            <option value="party">Employee / Vendor</option>
            <option value="type">Type</option>
            <option value="day">Day</option>
          </select>
        </div>
        <button className="btn">Generate</button>
        {result && (
          <button type="button" className="btn secondary" onClick={() => downloadCsv("/reports/csv?" + query(), "report.csv")}>
            Download CSV
          </button>
        )}
      </form>
      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <div className="cards">
            <div className="card"><span>Rows</span><b>{result.rows.length}</b></div>
            <div className="card"><span>Total quantity</span><b>{result.total_qty}</b></div>
            <div className="card"><span>Total value</span><b>{money(result.total_value)}</b></div>
          </div>

          {grouped ? (
            <div className="two-col">
              <div className="box">
                <Bar
                  data={{
                    labels: result.rows.map((r) => r.group_name),
                    datasets: [{ label: "Quantity", data: result.rows.map((r) => r.total_qty), backgroundColor: "#3b82f6" }],
                  }}
                  options={{ plugins: { legend: { display: false } } }}
                />
              </div>
              <div className="box">
                <table>
                  <thead><tr><th>Group</th><th>Records</th><th>Quantity</th><th>Value</th></tr></thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.group_name}>
                        <td>{r.group_name}</td>
                        <td>{r.records}</td>
                        <td>{r.total_qty}</td>
                        <td>{money(r.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="box">
              <table>
                <thead>
                  <tr><th>Date</th><th>Source</th><th>Type</th><th>Employee / Vendor</th><th>Product</th><th>Category</th><th>Qty</th><th>Stock</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.source + r.id}>
                      <td>{r.created_at}</td>
                      <td>{r.source}</td>
                      <td><span className={"tag " + r.tx_type.toLowerCase()}>{r.tx_type}</span></td>
                      <td>{r.party}</td>
                      <td>{r.product}</td>
                      <td>{r.category}</td>
                      <td>{r.quantity}</td>
                      <td>{r.stock_type}</td>
                      <td>{money(r.value)}</td>
                    </tr>
                  ))}
                  {result.rows.length === 0 && <tr><td colSpan="9" className="muted">Nothing found for these filters</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
