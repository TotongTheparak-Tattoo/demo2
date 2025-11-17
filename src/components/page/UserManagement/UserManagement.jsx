import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./UserManagement.css";

export default function UserManagement() {
  // ---------- Endpoints ----------
  const endpointList = "/api/v1/authen/get_all_account";
  const endpointAcceptSignup = "/api/v1/authen/accept_signup";
  const endpointDelete = "/api/v1/authen/delete_account";

  // ---------- State ----------
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // ---------- Utils ----------
  const pluckList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (payload && typeof payload === "object") return [payload];
    return [];
  };

  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });

  const isAdmin = (row) => {
    const ln = String(row?.levelName).toLowerCase().trim();
    return ln === "admin";
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const resp = await httpClient.get(endpointList, authHeaders());
      const list = pluckList(resp?.data);
      const withAdminFlag = list.map((r) => ({
        ...r,
        _isAdmin: isAdmin(r),
      }));

      setRows(withAdminFlag);
    } catch (e) {
      console.error("[UserManagement] fetchRows error:", e);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: e?.response?.data?.message || e?.message || "Cannot load users.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.empNo ?? "").toLowerCase().includes(q) ||
      String(r.email ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const doActivate = async (row) => {
    if (!row?.authId) return;
    const isActive = String(row.signupStatus).toLowerCase() === "activate";
    if (isActive) return;

    const ok = await Swal.fire({
      icon: "question",
      title: "Activate User?",
      text: `Do you want to activate this account: ${row.empNo} (${row.email})?`,
      showCancelButton: true,
      confirmButtonText: "Activate",
      cancelButtonText: "Cancel",
    }).then(r => r.isConfirmed);
    if (!ok) return;

    try {
      setActivatingId(row.authId);
      await httpClient.put(endpointAcceptSignup, { authId: row.authId }, authHeaders());
      setRows(prev => prev.map(it =>
        it.authId === row.authId ? { ...it, signupStatus: "activate" } : it
      ));
      await Swal.fire({ icon: "success", title: "Activated", timer: 1200, showConfirmButton: false });
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Activate failed",
        text: e?.response?.data?.message || e?.message || "Cannot activate this user.",
      });
    } finally {
      setActivatingId(null);
    }
  };

  const doDelete = async (row) => {
    if (!row?.authId) return;
    const ok = await Swal.fire({
      icon: "warning",
      title: "Delete Account?",
      html: `Are you sure you want to delete <b>${row.empNo}</b> (${row.email})?<br/>This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    }).then(r => r.isConfirmed);
    if (!ok) return;

    try {
      setDeletingId(row.authId);
      await httpClient.delete(endpointDelete, { ...authHeaders(), data: { auth_id: row.authId } });
      setRows(prev => prev.filter(it => it.authId !== row.authId));
      await Swal.fire({ icon: "success", title: "Deleted", timer: 1200, showConfirmButton: false });
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: e?.response?.data?.message || e?.message || "Cannot delete this user.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">ADMINISTRATOR</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">USER MANAGEMENT</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              USER MANAGEMENT
            </div>

            <div className="card-body gap-margin">
              {/* Table */}
              <div className="table-responsive">
                <table className="table table-striped table-hover table-custom table-compact">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Emp No</th>
                      <th style={{ width: 200 }}>Email</th>
                      <th style={{ width: 100 }}>Division</th>
                      <th style={{ width: 100 }}>Level</th>
                      <th style={{ width: 120 }}>Role</th>
                      <th style={{ width: 100, textAlign: "center" }}>Signup Status</th>
                      <th style={{ width: 140, textAlign: "center" }}>Activate User</th>
                      <th style={{ width: 140, textAlign: "center" }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "18px" }}>
                          No data
                        </td>
                      </tr>
                    )}

                    {filtered.map((r) => {
                      const division = r.divisionName || "-";
                      const level = r.levelName || "-";
                      const role = r.roleName || "-";
                      const isActive = String(r.signupStatus).toLowerCase() === "activate";
                      const admin = (r._isAdmin ?? isAdmin(r));

                      return (
                        <tr key={r.authId}>
                          <td>{r.empNo}</td>
                          <td>{r.email}</td>
                          <td>{division}</td>
                          <td>{level}</td>
                          <td>{role}</td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`badge ${isActive ? "bg-success" : "bg-secondary"}`}>
                              {isActive ? "activate" : (r.signupStatus || "deactivate")}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-sm btn-success angle"
                              disabled={isActive || activatingId === r.authId}
                              onClick={() => doActivate(r)}
                              title={isActive ? "Already active" : "Activate this user"}
                            >
                              {activatingId === r.authId ? "..." : "Activate"}
                            </button>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-sm btn-danger angle"
                              onClick={() => doDelete(r)}
                              disabled={deletingId === r.authId || admin}
                              title={admin ? "Admin cannot be deleted" : "Delete this user"}
                            >
                              {deletingId === r.authId ? "..." : "Delete"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
