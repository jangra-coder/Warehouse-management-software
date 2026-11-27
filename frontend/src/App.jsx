import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, getToken, setToken } from "./api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Employees from "./pages/Employees";
import Vendors from "./pages/Vendors";
import IssueReturn from "./pages/IssueReturn";
import VendorJobs from "./pages/VendorJobs";
import Requests from "./pages/Requests";
import Scrap from "./pages/Scrap";
import Reports from "./pages/Reports";
import Users from "./pages/Users";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // if a token is saved, check who is logged in
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function onLogin(token, userData) {
    setToken(token);
    setUser(userData);
  }

  async function onLogout() {
    await api("/auth/logout", "POST").catch(() => {});
    setToken(null);
    setUser(null);
  }

  if (loading) return <p className="center-msg">Loading...</p>;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={onLogin} />} />
      </Routes>
    );
  }

  // admin and manager can change things, a normal user can only view and make requests
  const canEdit = user.role === "admin" || user.role === "manager";

  return (
    <Layout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products canEdit={canEdit} />} />
        <Route path="/employees" element={<Employees canEdit={canEdit} />} />
        <Route path="/vendors" element={<Vendors canEdit={canEdit} />} />
        <Route path="/issue-return" element={canEdit ? <IssueReturn /> : <Navigate to="/" />} />
        <Route path="/vendor-jobs" element={canEdit ? <VendorJobs /> : <Navigate to="/" />} />
        <Route path="/requests" element={<Requests canEdit={canEdit} />} />
        <Route path="/scrap" element={<Scrap canEdit={canEdit} />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={user.role === "admin" ? <Users me={user} /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
