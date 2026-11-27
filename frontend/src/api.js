// small helper to call the backend
// the login token is kept in localStorage and sent with every request

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export async function api(path, method = "GET", body = null) {
  const options = { method, headers: { Authorization: "Bearer " + getToken() } };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const res = await fetch("/api" + path, options);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== "/auth/login") {
    // session is over, go back to login page
    setToken(null);
    window.location.href = "/login";
  }
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Something went wrong");
  }
  return data;
}

// download the report as a .csv file
export async function downloadCsv(path, filename) {
  const res = await fetch("/api" + path, { headers: { Authorization: "Bearer " + getToken() } });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function today(addDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
