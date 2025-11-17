// src/pages/Inbound/Putaway.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./Putaway.css";

export default function Putaway() {
  // ---------- State ----------
  const [vendorMaster, setVendorMaster] = useState([]);
  const [selectedVendorMaster, setSelectedVendorMaster] = useState("");

  const [scanPallet, setScanPallet] = useState("");
  const [scanLocation, setScanLocation] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const scanPalletRef = useRef(null);
  const tableRef = useRef(null);

  // ---------- Effects ----------
  useEffect(() => {
    getVendorMaster();
  }, []);

  useEffect(() => {
    if (selectedVendorMaster) {
      getPutAwayList();
      if (scanPalletRef.current) scanPalletRef.current.focus();
    } else {
      setRows([]);
    }
  }, [selectedVendorMaster]);

  // ---------- API ----------
  const getVendorMaster = async () => {
    try {
      const res = await httpClient.get(`/api/v1/vendorMaster/get_all_vendorMaster`);
      if (res.status === 200) {
        const list = Object.values(res.data?.result || {}).map((it) => ({
          vendorMasterName: it.vendorMasterName,
          vendorMasterId: it.vendorMasterId,
        }));
        setVendorMaster(list);
      } else {
        Swal.fire({
          title: "Info!",
          text: res.data?.detail || "No vendor data.",
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (err) {
      console.error("[getVendorMaster] error:", err);
      setVendorMaster([]);
    }
  };

  const getPutAwayList = async(showNoDataAlert = true) => {
    try {
      setLoading(true);
      const res = await httpClient.get(`/api/v1/inbound/putaway/get_putaway_list`, {
        params: { vendorId: selectedVendorMaster },
        headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN")}` },
      });

      if (res.status === 200) {
        const result = Array.isArray(res.data?.result) ? res.data.result : [];
        setRows(result);
      } else {
        if (showNoDataAlert) {
          Swal.fire({
            title: "There is no data!",
            text: res.data?.result || "No items.",
            icon: "info",
            timer: 5000,
            timerProgressBar: true,
          });
        }
      setRows([]);
      }
    } catch (err) {
      console.error("[getPutAwayList] error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const submitUpdatePutAway = async () => {
    const missing = [];
    if (!scanPallet.trim()) missing.push("Pallet No");
    if (!scanLocation.trim()) missing.push("Location");

    if (missing.length > 0) {
      Swal.fire({
        title: "Can't Put Away!",
        text: `Please input : ${missing.join(", ")}`,
        icon: "warning",
        timer: 3500,
        timerProgressBar: true,
      });
      if (scanPalletRef.current) scanPalletRef.current.focus();
      return;
    }

    // รองรับกรณีสแกนแล้วมี tab แทรก (เหมือน logic เดิม)
    const palletNo = String(scanPallet).split("\t")[0];

    try {
      const res = await httpClient.post(
        `/api/v1/inbound/putaway/submit_update_putaway`,
        { palletNo, locationCode: scanLocation.trim() },
        { headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN")}` } }
      );

      if (res.status === 200) {
        Swal.fire({
          title: "Put Away Success!",
          text: `Pallet has been put away to location ${scanLocation.trim()}`,
          icon: "success",
          timer: 1500,
          timerProgressBar: true,
        });
        await getPutAwayList(false);
        setScanPallet("");
        setScanLocation("");
        if (scanPalletRef.current) scanPalletRef.current.focus();
      } else {
        Swal.fire({
          title: "There is no data!",
          text: res.data?.detail || "Update failed",
          icon: "info",
        });
        setScanPallet("");
        setScanLocation("");
      }
    } catch (err) {
      console.error("[submitUpdatePutAway] error:", err);
      let errorMessage = "Failed to update.";
      if (err?.response?.data) {
        const responseData = err.response.data;
        if (typeof responseData.result === 'string') {
          errorMessage = responseData.result;
        } else if (responseData.result?.message) {
          errorMessage = responseData.result.message;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      Swal.fire({
        title: "Update Error",
        text: errorMessage,
        icon: "error",
      });
      // refresh ให้รายการล่าสุด และโฟกัสกลับไปสแกน
      setTimeout(() => {
        getPutAwayList();
        if (scanPalletRef.current) scanPalletRef.current.focus();
      }, 500);
      setScanPallet("");
      setScanLocation("");
    }
  };

  // ---------- CSV Export ----------
  const escapeCsv = (value) => {
    const v = String(value ?? "").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };

  const exportCsv = () => {
    if (!rows || rows.length === 0) {
      Swal.fire({ icon: "warning", title: "No Data!", text: "No data to export." });
      return;
    }

    const today = new Date();
    const file = `vmi_put_away_${String(today.getDate()).padStart(2, "0")}_${String(
      today.getMonth() + 1
    ).padStart(2, "0")}_${today.getFullYear()}.csv`;

    const columns = [
      { key: "receiveDate", label: "Receive Date" },
      { key: "receiveTime", label: "Receive Time" },
      { key: "vendor", label: "Vendor" },
      { key: "vendorName", label: "Vendor Name" },
      { key: "masterInvoiceNo", label: "Master Invoice No" },
      { key: "boxNo", label: "Pallet ID" },
      { key: "location", label: "Location" },
      { key: "caseNo", label: "Case No" },
      { key: "pono", label: "PO No" },
      { key: "lotNo", label: "Lot No" },
      { key: "quantity", label: "Quantity" },
      { key: "unit", label: "Unit" },
      { key: "width", label: "Width" },
      { key: "spec", label: "Spec" },
      { key: "size", label: "Size" },
      { key: "grossWeight", label: "Gross Weight" },
      { key: "importEntryNo", label: "Import Entry No" },
      { key: "zone", label: "Zone" },
      {
        key: "status",
        label: "Status",
        render: (r) => (String(r.status).toLowerCase() === "receive" ? "Waiting put away" : r.status ?? ""),
      },
    ];

    const lines = [];
    lines.push(columns.map((c) => escapeCsv(c.label)).join(","));
    rows.forEach((r) => {
      const vals = columns.map((c) => escapeCsv(c.render ? c.render(r) : r[c.key]));
      lines.push(vals.join(","));
    });

    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---------- Handlers ----------
  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      // เก็บ Tab สำหรับ scanner ที่ยิง \t เข้ามา (ตาม logic เดิม)
      setScanPallet((prev) => prev + "\t");
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const inputs = document.querySelectorAll("input");
      const currentIndex = Array.from(inputs).findIndex((el) => el === document.activeElement);
      const next = inputs[currentIndex + 1];
      if (next) {
        next.focus();
      } else {
        submitUpdatePutAway();
        if (scanPalletRef.current) scanPalletRef.current.focus();
      }
    }
  };

  // ---------- Render ----------
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">INBOUND</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">PUT AWAY</Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="card angle gap-margin">
          <div className="card-header card-receive">SCAN PUT AWAY</div>

          <div className="card-body gap-margin">
            {/* Controls */}
            <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {/* Vendor */}
              <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vp-label" style={{ minWidth: 120 }}>Vendor Name</span>
                <select
                  className="form-control angle"
                  value={selectedVendorMaster}
                  onChange={(e) => setSelectedVendorMaster(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ minWidth: 240 }}
                >
                  <option value="">Select Vendor</option>
                  {vendorMaster.map((v) => (
                    <option key={v.vendorMasterId} value={v.vendorMasterId}>
                      {v.vendorMasterName}
                    </option>
                  ))}
                </select>
              </label>

              {/* Scan Pallet */}
              <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vp-label" style={{ minWidth: 120 }}>Scan Pallet No</span>
                <input
                  type="text"
                  className="form-control angle scan-input"
                  ref={scanPalletRef}
                  value={scanPallet}
                  onChange={(e) => setScanPallet(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ backgroundColor: "#F3F5F5", maxWidth: 320 }}
                />
              </label>

              {/* Scan Location */}
              <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vp-label" style={{ minWidth: 120 }}>Scan Location</span>
                <input
                  type="text"
                  className="form-control angle scan-input"
                  value={scanLocation}
                  onChange={(e) => setScanLocation(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ backgroundColor: "#F3F5F5", maxWidth: 320 }}
                />
              </label>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Submit */}
              <button
                className="btn btn-success angle"
                style={{ width: 120, height: 40 }}
                onClick={submitUpdatePutAway}
                disabled={loading || !selectedVendorMaster}
                title={!selectedVendorMaster ? "Please select a vendor first" : "Submit"}
              >
                Submit
              </button>

              {/* Export CSV */}
              <button className="btn btn-info angle" onClick={exportCsv} disabled={loading || rows.length === 0}>
                EXPORT CSV
              </button>
            </div>

            {/* Table */}
            <div className="table-wrapper mt-3" ref={tableRef}>
              {loading ? (
                <div className="loading">Loading...</div>
              ) : rows.length === 0 ? (
                <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                  📄 No Data Available
                </div>
              ) : (
                <table className="table table-receive table-custom table-compact">
                  <colgroup>
                    <col className="col-putaway-date" />
                    <col className="col-putaway-time" />
                    <col className="col-putaway-vendor-code" />
                    <col className="col-putaway-vendor-name" />
                    <col className="col-putaway-mi" />
                    <col className="col-putaway-pallet" />
                    <col className="col-putaway-location" />
                    <col className="col-putaway-lot" />
                    <col className="col-putaway-lot" />
                    <col className="col-putaway-lot" />
                    <col className="col-putaway-qty" />
                    <col className="col-putaway-unit" />
                    <col className="col-putaway-width" />
                    <col className="col-putaway-spec" />
                    <col className="col-putaway-size" />
                    <col className="col-putaway-weight" />
                    <col className="col-putaway-vendor-name" />
                    <col className="col-putaway-zone" />
                    <col className="col-putaway-vendor-name" />
                  </colgroup>

                  <thead className="text-center">
                    <tr>
                      <th>Receive Date</th>
                      <th>Receive Time</th>
                      <th>Vendor</th>
                      <th>Vendor Name</th>
                      <th>Master Invoice No</th>
                      <th>Pallet ID</th>
                      <th>Location</th>
                      <th>Case No</th>
                      <th>PO No</th>
                      <th>Lot No</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Width</th>
                      <th>Spec</th>
                      <th>Size</th>
                      <th>Gross Weight</th>
                      <th>Import Entry No</th>
                      <th>Zone</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.palletNo}-${r.caseNo}-${i}`}>
                        <td>{r.receiveDate ?? ""}</td>
                        <td>{r.receiveTime ?? ""}</td>
                        <td>{r.vendor ?? ""}</td>
                        <td>{r.vendorName ?? ""}</td>
                        <td>{r.masterInvoiceNo ?? ""}</td>
                        <td>{r.boxNo ?? ""}</td>
                        <td>{r.location ?? ""}</td>
                        <td>{r.caseNo ?? ""}</td>
                        <td>{r.poNo ?? ""}</td>
                        <td>{r.lotNo ?? ""}</td>
                        <td>{r.quantity ?? ""}</td>
                        <td>{r.unit ?? ""}</td>
                        <td>{r.width ?? ""}</td>
                        <td>{r.spec ?? ""}</td>
                        <td>{r.size ?? ""}</td>
                        <td>{r.grossWeight ?? ""}</td>
                        <td>{r.importEntryNo ?? ""}</td>
                        <td>{r.zone ?? ""}</td>
                        <td>{String(r.status).toLowerCase() === "receive" ? "Waiting put away" : r.status ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary */}
            <div className="pager" style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <div>
                Total: <b>{rows.length.toLocaleString()}</b> items
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
