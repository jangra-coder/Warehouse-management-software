import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "../components/Modal";

export default function Users({ me }) {
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    api("/users").then(setUsers).catch((e) => alert(e.message));
  }

  useEffect(load, []);

  async function resetPassword(u) {
    const password = prompt(`New password for ${u.username} (min 6 characters)`);
    if (!password) return;
    try {
      await api(`/users/${u.user_id}/reset-password`, "POST", { password });
      alert("Password reset");
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="page-top">
        <h1>Users</h1>
        <button className="btn" onClick={() => setAdding(true)}>+ Add User</button>
      </div>
      <p className="muted">
        admin = everything, manager = everything except users, user = can view and make requests only.
      </p>

      <div className="box">
        <table>
          <thead>
            <tr><th>#</th><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className={u.is_active ? "" : "faded"}>
                <td>{u.user_id}</td>
                <td>{u.username}</td>
                <td>{u.full_name}</td>
                <td>{u.role}</td>
                <td>{u.is_active ? "Active" : "Disabled"}</td>
                <td>{u.created_at}</td>
                <td className="actions">
                  <button className="small-btn" onClick={() => setEditing(u)}>Edit</button>
                  <button className="small-btn" onClick={() => resetPassword(u)}>Reset password</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <AddUser onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      {editing && (
        <EditUser user={editing} isMe={editing.user_id === me.user_id}
          onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function AddUser({ onClose, onDone }) {
  const [form, setForm] = useState({ username: "", full_name: "", password: "", role: "user" });
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api("/users", "POST", form);
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Username</label>
        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <label>Full name</label>
        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <label>Password (min 6 characters)</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <label>Role</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        {error && <p className="error">{error}</p>}
        <button className="btn">Add</button>
      </form>
    </Modal>
  );
}

function EditUser({ user, isMe, onClose, onDone }) {
  const [form, setForm] = useState({ full_name: user.full_name, role: user.role, is_active: !!user.is_active });
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api("/users/" + user.user_id, "PUT", form);
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title={"Edit " + user.username} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Full name</label>
        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <label>Role</label>
        <select value={form.role} disabled={isMe} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={form.is_active} disabled={isMe}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn">Save</button>
      </form>
    </Modal>
  );
}
