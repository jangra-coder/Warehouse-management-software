import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { api, money } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const t = data.totals;
  const chartData = {
    labels: data.by_category.map((c) => c.category),
    datasets: [{ label: "Stock value (₹)", data: data.by_category.map((c) => c.value), backgroundColor: "#3b82f6" }],
  };

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="cards">
        <Card title="Products" value={t.products} />
        <Card title="Items in warehouse" value={t.on_shelf} />
        <Card title="Stock value" value={money(t.stock_value)} />
        <Card title="With employees" value={t.with_employees} />
        <Card title="At vendors" value={t.with_vendors} />
        <Card title="Low stock products" value={t.low_stock} red={t.low_stock > 0} />
        <Card title="Pending requests" value={data.pending_requests} red={data.pending_requests > 0} />
        <Card title="Active employees" value={data.active_employees} />
      </div>

      <div className="two-col">
        <div className="box">
          <h3>Stock value by category</h3>
          <Bar data={chartData} options={{ plugins: { legend: { display: false } } }} />
        </div>

        <div className="box">
          <h3>Low stock</h3>
          {data.low_stock.length === 0 ? (
            <p className="muted">All products have enough stock</p>
          ) : (
            <table>
              <thead>
                <tr><th>SKU</th><th>Product</th><th>In stock</th><th>Limit</th></tr>
              </thead>
              <tbody>
                {data.low_stock.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.sku}</td>
                    <td>{p.name}</td>
                    <td className="red">{p.on_shelf}</td>
                    <td>{p.low_stock_limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="box">
        <h3>Recent activity</h3>
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Employee / Vendor</th><th>Product</th><th>Qty</th></tr>
          </thead>
          <tbody>
            {data.recent.map((r, i) => (
              <tr key={i}>
                <td>{r.created_at}</td>
                <td><span className={"tag " + r.tx_type.toLowerCase()}>{r.tx_type}</span></td>
                <td>{r.party}</td>
                <td>{r.product}</td>
                <td>{r.quantity}</td>
              </tr>
            ))}
            {data.recent.length === 0 && (
              <tr><td colSpan="5" className="muted">Nothing yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value, red }) {
  return (
    <div className={red ? "card red-card" : "card"}>
      <span>{title}</span>
      <b>{value}</b>
    </div>
  );
}
