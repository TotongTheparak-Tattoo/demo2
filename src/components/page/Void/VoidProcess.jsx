import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./VoidProcess.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ENDPOINT_SCAN_VOID = "/api/v1/scanvoid/getdataallbymrnull"; // API endpoint สำหรับดึงข้อมูล void process

export default function VoidProcess() {
  const [rows, setRows] = useState([]);  /*ข้อมูลรายการทั้งหมด (filtered)*/
  const [allRowsForDate, setAllRowsForDate] = useState([]);  /*ข้อมูลรายการทั้งหมดสำหรับวันที่ที่เลือก (ใช้สำหรับสร้าง vendor options)*/
  const [loading, setLoading] = useState(false);  /*สถานะกำลังโหลดข้อมูล*/
  const [vendor, setVendor] = useState("");  /*Vendor ที่เลือก (ว่าง = ทั้งหมด)*/
  const [receiveDate, setReceiveDate] = useState(() => {  /*วันที่รับสินค้า (filter) - default เป็นวันนี้*/
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  /*React Router navigate hook*/
  const navigate = useNavigate();
  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });

  // ============================================================================
  // HELPER FUNCTIONS - Date & Formatting
  // ============================================================================
  /*แปลงวันที่เป็นรูปแบบ DD/MM/YYYY (en-GB)*/
  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
  };

  /*แปลง string YYYY-MM-DD เป็น Date object*/
  const ymdToDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /*แปลง Date object เป็น string YYYY-MM-DD*/
  const dateToYMD = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูล vendor ทั้งหมดสำหรับวันที่ที่เลือก (ใช้สำหรับสร้าง vendor options)*/
  const fetchVendorsFromList = async () => {
    try {
      const params = {};
      if (receiveDate) params.receiveDate = receiveDate;
      const resp = await httpClient.get(ENDPOINT_SCAN_VOID, { ...authHeaders(), params });
      const data = resp?.data;
      const list = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
        ? data
        : [];
      setAllRowsForDate(list);
    } catch (err) {
      console.error("[fetchVendorsFromList] error:", err);
      setAllRowsForDate([]);
    }
  };

  /*ดึงข้อมูลรายการตาม filter (receiveDate และ vendor)*/
  const fetchList = async () => {
    setLoading(true);
    try {
      const params = {};
      if (receiveDate) params.receiveDate = receiveDate;
      if (vendor) params.vendor = vendor;
      const resp = await httpClient.get(ENDPOINT_SCAN_VOID, { ...authHeaders(), params });
      const data = resp?.data;
      const list = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
        ? data
        : [];
      setRows(list);
    } catch (err) {
      console.error("[fetchList] error:", err);
      Swal.fire({
        icon: "error",
        title: "Load failed",
        text:
          err?.response?.data?.message ||
          err?.message ||
          "Unable to contact the server.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================
  /*โหลดข้อมูล vendor และรายการเมื่อ receiveDate เปลี่ยน*/
  useEffect(() => {
    (async () => {
      await fetchVendorsFromList();
      await fetchList();
    })();
  }, [receiveDate]);

  /*โหลดข้อมูลรายการเมื่อ vendor เปลี่ยน*/
  useEffect(() => {
    fetchList();
  }, [vendor]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*รายการ Vendor ที่มีในข้อมูลสำหรับวันที่ที่เลือก (เรียงตามตัวอักษร)*/
  const vendorOptions = useMemo(() => {
    const set = new Set();
    for (const r of allRowsForDate) {
      const name = String(r.vendorMasterName ?? r.vendorName ?? "").trim();
      if (name) set.add(name);
    }
    return [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [allRowsForDate]);

  /*จัดกลุ่มข้อมูลตาม Pallet No และรวม Quantity*/
  const keyPallet = (v) => String(v ?? "").trim();
  const palletRows = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = keyPallet(r.palletNo);
      if (!map.has(k)) {
        map.set(k, { rep: r, palletNo: k, totalQty: Number(r.quantity) || 0 });
      } else {
        const g = map.get(k);
        g.totalQty += Number(r.quantity) || 0;
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.palletNo || "~~~~").localeCompare(b.palletNo || "~~~~"));
    return arr.map(({ rep, palletNo, totalQty }) => ({
      ...rep,
      palletNo,
      quantity: totalQty,
    }));
  }, [rows]);

  // ============================================================================
  // EVENT HANDLERS - Navigation
  // ============================================================================
  /*นำทางไปหน้า Scan Void พร้อมส่ง palletNo และ filters*/
  const navigateToScan = (palletNo) => {
    navigate("/vmi-void-scan", { state: { palletNo, filters: { receiveDate, vendor } } });
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          {/* Breadcrumb */}
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">VOID</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">Void Process</Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="card angle gap-margin">
          <div className="card-header card-void">Void Process</div>

          <div className="card-body gap-margin">
            {/* Filters */}
            <div className="vp-controls">
              {/* Vendor Filter */}
              <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vp-label" style={{ minWidth: 100, margin: 0 }}>Vendor</span>
                <select
                  className="form-control angle"
                  style={{ minWidth: 240 }}
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                >
                  <option key="__all__" value="">Select vendor</option>
                  {(vendorOptions || []).map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </label>

              {/* Receive Date Filter */}
              <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vp-label" style={{ minWidth: 100, margin: 0 }}>Receive Date</span>
                <DatePicker
                  selected={ymdToDate(receiveDate)}
                  onChange={(d) => setReceiveDate(dateToYMD(d))}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="dd/mm/yyyy"
                  className="form-control angle"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  portalId="root"
                  popperClassName="vp-popper"
                />
              </label>
            </div>

            {/* Subheader */}
            <div className="vp-subheader">Outbound Void (1 row per pallet)</div>

            {/* Table */}
            <div className="table-wrapper table-h-scroll mt-3">
              {loading ? (
                <div className="loading">Loading...</div>
              ) : palletRows.length === 0 ? (
                <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                  📄 No Data
                </div>
              ) : (
                <table className="table table-receive table-custom table-compact table-wide">
                  <colgroup>
                    <col className="col-click" />
                    <col className="col-date" />
                    <col className="col-vendor" />
                    <col className="col-mi" />
                    <col className="col-pallet" />
                    <col className="col-case" />
                    <col className="col-qty" />
                    <col className="col-status" />
                    <col className="col-spec" />
                    <col className="col-size" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Receive Date</th>
                      <th>Vendor Name</th>
                      <th>MasterInvoiceNo</th>
                      <th>Pallet ID</th>
                      <th>Case No</th>
                      <th>Quantity (Sum)</th>
                      <th>Status</th>
                      <th>Spec</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {palletRows.map((r, i) => (
                      <tr
                        key={r.palletNo || r.productBalanceId || `${r.masterInvoiceNo}-${r.caseNo}-${i}`}
                      >
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline-dark"
                            onClick={() => navigateToScan(r.palletNo || "")}
                          >
                            Scan Void
                          </button>
                        </td>
                        <td>{fmtDate(r.receiveDate)}</td>
                        <td>{r.vendorMasterName ?? r.vendorName ?? ""}</td>
                        <td>{r.masterInvoiceNo ?? ""}</td>
                        <td>{r.boxNo ?? ""}</td>
                        <td>{r.caseNo ?? ""}</td>
                        <td>{r.quantity ?? ""}</td>
                        <td>{r.productStatusName ?? ""}</td>
                        <td>{r.spec ?? ""}</td>
                        <td>{r.size ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer - Summary */}
            <div className="vp-footer">
              All pallets: <b>{palletRows.length.toLocaleString()}</b> group ·{" "}
              All items: <b>{rows.length.toLocaleString()}</b> list
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
