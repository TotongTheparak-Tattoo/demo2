import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./VendorUpload.css";

export default function VendorUpload() {
  // Endpoints
  const endpointListVendors = "/api/v1/vendorMaster/get_all_vendorMaster";
  const endpointCreateVendor = "/api/v1/vendor/create";

  // Auth
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });

  // State
  const [vendors, setVendors] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [vendorMasterCode, setVendorMasterCode] = useState("");
  const [vendorMasterName, setVendorMasterName] = useState("");
  const [creating, setCreating] = useState(false);

  // Utils
  const pluckRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  const showError = (title, text, icon = "error") =>
    Swal.fire({ title, text, icon, timer: 2500, timerProgressBar: true });

  // Fetch vendors
  const fetchVendors = async () => {
    try {
      setLoadingList(true);
      const resp = await httpClient.get(endpointListVendors, authHeaders());
      setVendors(pluckRows(resp?.data));
    } catch (err) {
      console.error("[VendorUpload] fetchVendors error:", err);
      showError(
        "Load vendors failed",
        err?.response?.data?.result?.message || "Cannot load vendors"
      );
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Create vendor (ไม่มี maker แล้ว)
  const onCreateVendor = async () => {
    if (!vendorMasterCode.trim() || !vendorMasterName.trim()) {
      showError("Missing fields", "Please fill vendor code and name", "info");
      return;
    }

    try {
      setCreating(true);
      const payload = {
        vendorMasterCode: vendorMasterCode.trim(),
        vendorMasterName: vendorMasterName.trim(),
      };
      const resp = await httpClient.post(endpointCreateVendor, payload, authHeaders());
      if (resp.status === 200 || resp.status === 201) {
        Swal.fire({ title: "Created!", icon: "success", timer: 1500, timerProgressBar: true });
        setVendorMasterCode("");
        setVendorMasterName("");
        fetchVendors();
      } else {
        const msg = resp?.data?.message || resp?.data?.result || "Create failed";
        showError("Info!", msg, "info");
      }
    } catch (err) {
      console.error("[VendorUpload] onCreateVendor error:", err);
      const msg = err?.response?.data?.result?.message || "Create failed";
      showError("Create vendor failed", msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">MASTER</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">VENDOR UPLOAD</Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="card angle gap-margin">
          <div className="card-header card-picking">Manage Vendors</div>
          <div className="card-body gap-margin">

            {/* Create form */}
            <div className="insert-section">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                {/* Vendor Code */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 160 }}>Vendor Code</span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={vendorMasterCode}
                    onChange={(e) => setVendorMasterCode(e.target.value)}
                    placeholder="e.g. 2000528"
                    style={{ minWidth: 240 }}
                  />
                </label>

                {/* Vendor Name */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 160 }}>Vendor Name</span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={vendorMasterName}
                    onChange={(e) => setVendorMasterName(e.target.value)}
                    placeholder="e.g. TOYOTA TSUSHO (THAILAND) CO.,LTD."
                    style={{ minWidth: 320 }}
                  />
                </label>

                {/* Add Vendor */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-primary angle"
                    onClick={onCreateVendor}
                    disabled={creating}
                  >
                    {creating ? "Saving..." : "Add Vendor"}
                  </button>
                </label>

                <div style={{ flex: 1 }} />

                {/* Refresh List */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-light angle"
                    onClick={fetchVendors}
                    disabled={loadingList}
                  >
                    {loadingList ? "Refreshing..." : "Refresh List"}
                  </button>
                </label>
              </div>
            </div>

            {/* table */}
            <div className="table-wrapper mt-2">
              {loadingList ? (
                <div className="loading">Loading...</div>
              ) : vendors.length === 0 ? (
                <div className="no-data-cell" style={{ padding: 20 }}>📄 No Data</div>
              ) : (
                <table className="table table-receive table-custom table-compact vendor-table">
                  <colgroup>
                    <col className="c-vendor-code" />
                    <col className="c-vendor-name" />
                  </colgroup>

                  <thead className="text-center">
                    <tr>
                      <th>Vendor Code</th>
                      <th>Vendor Name</th>
                    </tr>
                  </thead>

                  <tbody>
                    {vendors.map((v, idx) => (
                      <tr key={v.vendorMasterId ?? v.id ?? `${v.vendorMasterCode}-${idx}`}>
                        <td title={v.vendorMasterCode ?? v.code ?? "-"}>
                          {v.vendorMasterCode ?? v.code ?? "-"}
                        </td>
                        <td title={v.vendorMasterName ?? v.name ?? "-"}>
                          {v.vendorMasterName ?? v.name ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
