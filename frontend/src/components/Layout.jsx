import { useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import Modal from "./Modal";

export default function Layout({ user, onLogout, children }) {
  const [showPassword, setShowPassword] = useState(false);
  const canEdit = user.role === "admin" || user.role === "manager";

  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/products", label: "Products" },
    { to: "/issue-return", label: "Issue / Return", show: canEdit },
    { to: "/vendor-jobs", label: "Vendor Jobs", show: canEdit },
    { to: "/requests", label: "Requests" },
    { to: "/employees", label: "Employees" },
    { to: "/vendors", label: "Vendors" },
    { to: "/scrap", label: "Scrap" },
    { to: "/reports", label: "Reports" },
    { to: "/users", label: "Users", show: user.role === "admin" },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          Warehouse
          <small>Management Software</small>
        </div>
        <nav>
          {links
            .filter((l) => l.show !== false)
            .map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"}>
                {l.label}
              </NavLink>
            ))}
        </nav>
        <div className="user-box">
          <b>{user.full_name}</b>
          <span className="role">{user.role}</span>
          <button className="link-btn" onClick={() => setShowPassword(true)}>Change password</button>
          <button className="link-btn" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main className="content">{children}</main>

      {showPassword && <ChangePassword onClose={() => setShowPassword(false)} />}
    </div>
  );
}

function ChangePassword({ onClose }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api("/auth/change-password", "POST", { old_password: oldPass, new_password: newPass });
      alert("Password changed");
      onClose();
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      <form onSubmit={save} className="form">
        <label>Old password</label>
        <input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
        <label>New password (min 6 characters)</label>
        <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        {msg && <p className="error">{msg}</p>}
        <button className="btn">Save</button>
      </form>
    </Modal>
  );
}
