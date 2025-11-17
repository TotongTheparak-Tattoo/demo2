import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./TransactionMovementLog.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PAGE_SIZE = 50;
const BASE_ACTION_OPTION = { value: "", label: "All actions" };
const ENDPOINT_LIST = "/api/v1/transactionmovementlog/getdata";


// ============================================================================
// HELPER FUNCTIONS - Date & Formatting
// ============================================================================
/*Get today's date in YYYY-MM-DD format*/
const getTodayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
/*Format date (DD/MM/YYYY)*/
const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
};
/*Format time (HH:mm)*/
const fmtTime = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
/*Convert YYYY-MM-DD string to Date object*/
const ymdToDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
/*Convert Date object to YYYY-MM-DD string*/
const dateToYMD = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
/*Escape value for CSV format*/
const escapeCsv = (value) => {
  const v = String(value ?? "").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

// ============================================================================
// HELPER FUNCTIONS - Action Options
// ============================================================================
/*Normalize action name*/
const normalizeAction = (value) => String(value ?? "").trim();
/*Merge action options from sources*/
const mergeActionOptions = (prevOptions = [], candidates = [], currentValue = "") => {
  const options = [BASE_ACTION_OPTION];
  const seen = new Set([BASE_ACTION_OPTION.value]);

  const addOption = (value) => {
    const normalized = normalizeAction(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    options.push({ value: normalized, label: normalized });
  };

  prevOptions.forEach((opt) => {
    if (opt?.value) addOption(opt.value);
  });
  candidates.forEach(addOption);
  if (currentValue) addOption(currentValue);
  return options;
};

export default function TransactionMovementLog() {
  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Data state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Filter state
  const [action, setAction] = useState("");
  const [actionOptions, setActionOptions] = useState([BASE_ACTION_OPTION]);
  const [dateFrom, setDateFrom] = useState(getTodayYMD());
  const [dateTo, setDateTo] = useState(getTodayYMD());
  // UI refs
  const tableRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API & Data Normalization
  // ============================================================================
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });
  /*แปลง response จาก API ให้เป็น array*/
  const pluckRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result)) return payload.result;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  /*ดึงจำนวน total จาก response*/
  const pluckTotal = (payload) => {
    const n =
      payload?.total ??
      0;
    return Number(n) || 0;
  };
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูลจาก API ตามหน้าและ filter*/
  const fetchPage = async (pageNo = 1, size = PAGE_SIZE) => {
    setLoading(true);
    try {
      const params = {
        page: pageNo,
        limit: size,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const resp = await httpClient.get(ENDPOINT_LIST, { ...authHeaders(), params });
      const data = resp?.data ?? {};
      const list = pluckRows(data);
      const ttl = pluckTotal(data);

      setRows(list);
      setTotal(ttl || list.length);
      setPage(pageNo);
      // Update action options from current page
      const actionsFromRows = list.map((row) => row?.action).filter(Boolean);
      setActionOptions((prev) => mergeActionOptions(prev, actionsFromRows, action));

      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[TransactionMovementLog] fetchPage error:", e);
      setRows([]);
      setTotal(0);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text:
          e?.response?.data?.message ||
          e?.message ||
          "Could not contact the server or load data.",
        confirmButtonText: "OK",
      });
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchPage(1, PAGE_SIZE);
  }, [action, dateFrom, dateTo]);
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*คำนวณจำนวนหน้าทั้งหมด*/
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  /*Export ข้อมูลเป็น CSV*/
  const exportCsv = async () => {
    if (exporting) return;

    try {
      setExporting(true);
      // กำหนด columns สำหรับ CSV
      const columns = [
        { key: "registered_at", label: "Registered At", render: (r) => fmtDate(r.createdAt) },
        { key: "registered_time", label: "Time", render: (r) => fmtTime(r.createdAt) },
        { key: "invoiceNo", label: "Invoice No" },
        { key: "itemNo", label: "Item No" },
        { key: "exporterNameEN", label: "Exporter NameEN" },
        { key: "description", label: "Desc." },
        { key: "declarationNo", label: "Declaration No" },
        { key: "declarationLineNumber", label: "Declaration Line Number" },
        { key: "ctrlDeclarationNo", label: "Ctrl Declaration No" },
        { key: "action", label: "Action" },
      ];
      const paramsBase = {
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const batchSize = Math.max(PAGE_SIZE, 200);
      const allRows = [];
      let pageCursor = 1;
      let totalExpected = 0;
      const maxPages = 500;
      // ดึงข้อมูลทั้งหมดจากทุกหน้า
      while (true) {
        const resp = await httpClient.get(ENDPOINT_LIST, {
          ...authHeaders(),
          params: { ...paramsBase, page: pageCursor, limit: batchSize },
        });

        const payload = resp?.data ?? {};
        const pageRows = pluckRows(payload);

        if (pageCursor === 1) {
          totalExpected = pluckTotal(payload) || pageRows.length;
        }

        if (pageRows.length > 0) {
          allRows.push(...pageRows);
        }

        // เงื่อนไขหยุด loop
        const reachedTotal = totalExpected > 0 && allRows.length >= totalExpected;
        const noMoreData = pageRows.length < batchSize;
        const reachedPageCap = pageCursor >= maxPages;

        if (reachedTotal || noMoreData || reachedPageCap) break;

        pageCursor += 1;
      }

      const exportRows = allRows.length > 0 ? allRows : rows;
      if (!exportRows.length) {
        Swal.fire({ icon: "info", title: "No Data", text: "No rows to export." });
        return;
      }
      // สร้าง CSV content
      const lines = [];
      lines.push(columns.map((c) => escapeCsv(c.label)).join(",")); // Header row
      exportRows.forEach((r) => {
        const vals = columns.map((c) => escapeCsv(c.render ? c.render(r) : r[c.key]));
        lines.push(vals.join(","));
      });
      // สร้างไฟล์และดาวน์โหลด
      const csv = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `transaction_movement_log_${dateFrom || "start"}_${dateTo || "end"}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[TransactionMovementLog][exportCsv] error:", err);
      Swal.fire({
        icon: "error",
        title: "Export failed",
        text: err?.message || "An error occurred while generating the file.",
      });
    } finally {
      setExporting(false);
    }
  };
  /*Clear all filters*/
  const onClear = () => {
    setAction("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    fetchPage(1, PAGE_SIZE);
  };
  /*Go to previous page*/
  const goPrev = () => {
    if (page > 1) fetchPage(page - 1);
  };

  /*Go to next page*/
  const goNext = () => {
    if (page < totalPages) fetchPage(page + 1);
  };
  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          {/* Breadcrumb Navigation */}
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">REPORT</li>
                <li className="breadcrumb-item">
                  <Link to="/vmi-report-menu" className="color-link">
                    Logistics Report
                  </Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">
                    TRANSACTION MOVEMENT LOG
                  </Link>
                </li>
              </ol>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Transaction Movement Log
            </div>

            <div className="card-body gap-margin">
              {/* Filter Controls */}
              <div
                className="controls"
                style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
              >
                {/* Action Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 70 }}>
                    Action
                  </span>
                  <select
                    className="form-control angle"
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      setPage(1);
                    }}
                    style={{ minWidth: 160 }}
                  >
                    {actionOptions.map((opt) => (
                      <option key={opt.value || "__all"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Date From */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 110 }}>
                    Date from
                  </span>
                  <DatePicker
                    selected={ymdToDate(dateFrom)}
                    onChange={(d) => {
                      setDateFrom(dateToYMD(d));
                      setPage(1);
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="form-control angle"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    portalId="root"
                  />
                </label>

                {/* Date To */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 25 }}>to</span>
                  <DatePicker
                    selected={ymdToDate(dateTo)}
                    onChange={(d) => {
                      setDateTo(dateToYMD(d));
                      setPage(1);
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="form-control angle"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    portalId="root"
                  />
                </label>

                {/* Clear Button */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-secondary angle"
                    onClick={onClear}
                    disabled={loading}
                  >
                    Clear
                  </button>
                </label>

                <div style={{ flex: 1 }} />

                {/* Export CSV Button */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-success angle"
                    onClick={exportCsv}
                    disabled={loading || exporting || rows.length === 0}
                  >
                    {exporting ? "Exporting..." : "Export CSV"}
                  </button>
                </label>
              </div>

              {/* Data Table */}
              <div className="table-wrapper table-h-scroll table-resize mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                    📄 No Data
                  </div>
                ) : (
                  <table className="table table-receive table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-tmlog-date" />
                      <col className="col-tmlog-time" />
                      <col className="col-tmlog-inv" />
                      <col className="col-tmlog-item" />
                      <col className="col-tmlog-exporter" />
                      <col className="col-tmlog-desc" />
                      <col className="col-tmlog-declaration" />
                      <col className="col-tmlog-declarationline" />
                      <col className="col-tmlog-ctrldec" />
                      <col className="col-tmlog-action" />
                    </colgroup>

                    <thead className="text-center">
                      <tr>
                        <th>Registered Date</th>
                        <th>Time</th>
                        <th>Invoice No</th>
                        <th>Item No</th>
                        <th>Exporter NameEN</th>
                        <th>Desc.</th>
                        <th>Declaration No</th>
                        <th>Declaration Line Number</th>
                        <th>Ctrl Declaration No</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.transactionMovementLogId ?? i}>
                          <td>{fmtDate(r.createdAt)}</td>
                          <td>{fmtTime(r.createdAt)}</td>
                          <td>{r.invoiceNo ?? "-"}</td>
                          <td>{r.itemNo ?? "-"}</td>
                          <td>{r.exporterNameEN ?? "-"}</td>
                          <td>{r.description ?? "-"}</td>
                          <td>{r.declarationNo ?? "-"}</td>
                          <td>{r.declarationLineNumber ?? "-"}</td>
                          <td>{r.ctrlDeclarationNo ?? "-"}</td>
                          <td>{r.action ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination Controls */}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontStyle: "italic" }}>
                  Total rows: {Number(total || 0).toLocaleString()}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className="btn btn-light angle"
                    onClick={goPrev}
                    disabled={!canPrev || loading}
                  >
                    ◀ Prev
                  </button>
                  <span>
                    Page <b>{page}</b> / {totalPages.toLocaleString()}
                  </span>
                  <button
                    className="btn btn-light angle"
                    onClick={goNext}
                    disabled={!canNext || loading}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
