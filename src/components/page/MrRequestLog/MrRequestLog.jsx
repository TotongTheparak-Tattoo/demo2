import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./MrRequestLog.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PAGE_SIZE = 50;
const ENDPOINT_LIST = "/api/v1/mrrequestlog/getdata";

// ============================================================================
// HELPER FUNCTIONS - Date & Formatting
// ============================================================================
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
/*Convert date to YYYY-MM-DD format*/
const toYMD = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
/*Get today's date in YYYY-MM-DD format*/
const getTodayYMD = () => {
  const d = new Date();
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

export default function MrRequestLog() {
  // ============================================================================
  // ROUTER & NAVIGATION
  // ============================================================================
  const { state } = useLocation();
  const navigate = useNavigate();
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Data state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Filter state
  const [masterLot, setMasterLot] = useState(String(state?.invoiceNo_MasterLot ?? "").trim());
  const [partialInv, setPartialInv] = useState(String(state?.invoiceNo_PartialInv ?? "").trim());
  const [mrNo, setMrNo] = useState(String(state?.mrNo ?? "").trim());
  const [dateFrom, setDateFrom] = useState(state?.dateFrom ?? getTodayYMD());
  const [dateTo, setDateTo] = useState(state?.dateTo ?? getTodayYMD());
  // UI refs
  const tableRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API & Data Normalization
  // ============================================================================
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
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
        masterLot: masterLot || undefined,
        partialInv: partialInv || undefined,
        mrNo: mrNo || undefined,
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

      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[MrRequestLog] fetchPage error:", e);
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
  }, [masterLot, partialInv, mrNo, dateFrom, dateTo]);
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*คำนวณจำนวนหน้าทั้งหมด*/
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  /*สร้างชื่อไฟล์สำหรับ export*/
  const fileDate = useMemo(() => {
    if (dateFrom || dateTo) return `${dateFrom || "start"}_to_${dateTo || "end"}`;
    const firstDate = rows[0]?.stockOutDate ?? null;
    return toYMD(firstDate) || new Date().toISOString().slice(0, 10);
  }, [rows, dateFrom, dateTo]);
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
        {key: "stockOutDate",label: "Stock Out Date",render: (r) => fmtDate(r.stockOutDate) ?? "-",},
        {key: "createdAt", label: "Time", render: (r) => fmtTime(r.createdAt) ?? "-" },
        {key: "mrNo", label: "MR No", render: (r) => r.mrNo ?? "-" },
        {key: "mrNoDate", label: "MR No Date", render: (r) => fmtDate(r.mrNoDate) ?? "-" },
        {key: "invoiceNo_MasterLot",label: "Master Lot",render: (r) => r.invoiceNo_MasterLot ?? "-"},
        {key: "invoiceNo_PartialInv",label: "Partial Invoice",render: (r) => r.invoiceNo_PartialInv ?? "-"},
        {key: "exportEntryNo",label: "ExportEntryNo",render: (r) => r.exportEntryNo ?? "-"},
        {key: "nmbPoNo",label: "PO No",render: (r) => r.nmbPoNo ?? "-"},
        {key: "itemName",label: "Item Name",render: (r) => r.itemName ?? "-"},
        {key: "caseNo",label: "Case No",render: (r) => r.caseNo ?? "-"},
        {key: "lotNo",label: "Lot No",render: (r) => r.lotNo ?? "-"},
        {key: "spec",label: "Spec",render: (r) => r.spec ?? "-"},
        {key: "size",label: "Size",render: (r) => r.size ?? "-"},
        {key: "quantity",label: "Qty",render: (r) => r.quantity ?? "-"},
        {key: "unit",label: "Unit",render: (r) => r.unit ?? "-"},
        {key: "remark",label: "Remark",render: (r) => r.remark ?? "-"},
        {key: "vendorMasterId",label: "Vendor Master Id",render: (r) => r.vendorMasterId ?? "-"},
        {key: "productStatusId",label: "Product Status Id",render: (r) => r.productStatusId ?? "-"},
        {key: "locationId",label: "Location Id",render: (r) => r.locationId ?? "-"},
      ];
      const paramsBase = {
        masterLot: masterLot || undefined,
        partialInv: partialInv || undefined,
        mrNo: mrNo || undefined,
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
        const vals = columns.map((c) => {
          const raw = c.render ? c.render(r) : r[c.key];
          return escapeCsv(raw);
        });
        lines.push(vals.join(","));
      });
      // สร้างไฟล์และดาวน์โหลด
      const csv = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `mr_request_log_${fileDate}_${exportRows.length}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[MrRequestLog][exportCsv] error:", err);
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
    setMasterLot("");
    setPartialInv("");
    setMrNo("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
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
                    MR REQUEST LOG
                  </Link>
                </li>
              </ol>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              MR Request Log
            </div>

            <div className="card-body gap-margin">
              {/* Filter Controls */}
              <div
                className="controls"
                style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
              >
                {/* Master Lot Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 110 }}>
                    Master Lot
                  </span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={masterLot}
                    onChange={(e) => {
                      setMasterLot(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g. GR-85913"
                    style={{ minWidth: 220 }}
                  />
                </label>

                {/* Partial Invoice Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 120 }}>
                    Partial Invoice
                  </span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={partialInv}
                    onChange={(e) => {
                      setPartialInv(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g. B/04/06/25"
                    style={{ minWidth: 220 }}
                  />
                </label>

                {/* MR No Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 70 }}>
                    MR No
                  </span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={mrNo}
                    onChange={(e) => {
                      setMrNo(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g. MR-2025..."
                    style={{ minWidth: 240 }}
                  />
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
                    popperClassName="mrlog-popper"
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
                    popperClassName="mrlog-popper"
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
              <div className="table-wrapper table-h-scroll mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                    📄 No Data
                  </div>
                ) : (
                  <table className="table table-receive table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-mrlog-stockdate" />
                      <col className="col-mrlog-time" />
                      <col className="col-mrlog-mrno" />
                      <col className="col-mrlog-mrnodate" />
                      <col className="col-mrlog-mrnoinc" />
                      <col className="col-mrlog-masterlot" />
                      <col className="col-mrlog-partialinv" />
                      <col className="col-mrlog-pono" />
                      <col className="col-mrlog-itemname" />
                      <col className="col-mrlog-caseno" />
                      <col className="col-mrlog-lotno" />
                      <col className="col-mrlog-spec" />
                      <col className="col-mrlog-size" />
                      <col className="col-mrlog-qty" />
                      <col className="col-mrlog-unit" />
                      <col className="col-mrlog-remark" />
                    </colgroup>

                    <thead className="text-center">
                      <tr>
                        <th>Stock Out Date</th>
                        <th>Time</th>
                        <th>MR No</th>
                        <th>MR No Date</th>
                        <th>Master Lot</th>
                        <th>Partial Invoice</th>
                        <th>ExportEntryNo</th>
                        <th>PO No</th>
                        <th>Item Name</th>
                        <th>Case No</th>
                        <th>Lot No</th>
                        <th>Spec</th>
                        <th>Size</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Remark</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={
                            r.mrRequestLogId ??
                            `${r.mrNo}-${r.invoiceNo_MasterLot}-${r.caseNo}-${r.stockOutDate}`
                          }
                        >
                          <td>{fmtDate(r.createdAt)}</td>
                          <td>{fmtTime(r.createdAt)}</td>
                          <td>{r.mrNo ?? "-"}</td>
                          <td>{fmtDate(r.mrNoDate)}</td>
                          <td>{r.invoiceNo_MasterLot ?? "-"}</td>
                          <td>{r.invoiceNo_PartialInv ?? "-"}</td>
                          <td>{r.exportEntryNo ?? "-"}</td>
                          <td>{r.nmbPoNo ?? "-"}</td>
                          <td>{r.itemName ?? "-"}</td>
                          <td>{r.caseNo ?? "-"}</td>
                          <td>{r.lotNo ?? "-"}</td>
                          <td>{r.spec ?? "-"}</td>
                          <td>{r.size ?? "-"}</td>
                          <td>{r.quantity ?? "-"}</td>
                          <td>{r.unit ?? "-"}</td>
                          <td>{r.remark ?? "-"}</td>
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
