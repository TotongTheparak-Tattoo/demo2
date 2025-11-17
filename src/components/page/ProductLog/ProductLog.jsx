import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./ProductLog.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PAGE_SIZE = 50;
const BASE_STATUS_OPTION = { value: "", label: "All statuses" };
const ENDPOINT_LIST = "/api/v1/productlog/getdata";

// ============================================================================
// HELPER FUNCTIONS - Status Options
// ============================================================================
/*Normalize status name*/
const normalizeStatusName = (value) => String(value ?? "").trim();
/*Get status key for comparison*/
const statusKey = (value) => normalizeStatusName(value).toLowerCase();
/*Build status options list from sources*/
const buildStatusOptions = (sources = [], currentValue = "", previous = []) => {
  const options = [BASE_STATUS_OPTION];
  const seen = new Set();

  const addOption = (value) => {
    const normalized = normalizeStatusName(value);
    if (!normalized) return;
    const key = statusKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value: normalized, label: normalized });
  };

  previous.forEach((opt) => {
    if (opt?.value) addOption(opt.value);
  });
  sources.forEach(addOption);
  addOption(currentValue);

  return options;
};
// ============================================================================
// HELPER FUNCTIONS - Date & Formatting
// ============================================================================
/*Format time (HH:mm)*/
const fmtTime = (v) => {
  if (!v) return "";
    const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
/*Format date (DD/MM/YYYY)*/
const fmtDate = (v) => {
  if (!v) return "";
    const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
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
/*Pick first non-empty value from candidates*/
const pick = (...candidates) => {
  for (const v of candidates) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};
export default function ProductLog() {
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
  const initialStatus = useMemo(
    () => normalizeStatusName(state?.statusMasterName ?? state?.productStatusName ?? ""),
    [state?.statusMasterName, state?.productStatusName]
  );
  const [statusName, setStatusName] = useState(initialStatus);
  const [statusOptions, setStatusOptions] = useState(() => buildStatusOptions([], initialStatus));
  const [masterLot, setMasterLot] = useState(
    String(state?.masterInvoiceNo ?? state?.invoiceNo_MasterLot ?? "").trim()
  );
  const [dateFrom, setDateFrom] = useState(state?.dateFrom ?? getTodayYMD());
  const [dateTo, setDateTo] = useState(state?.dateTo ?? getTodayYMD());
  // UI refs
  const tableRef = useRef(null);
  const abortRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API & Data Normalization
  // ============================================================================
  /*สร้าง headers สำหรับ authentication*/
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
      payload?.count ??
      payload?.pagination?.total ??
      payload?.result?.total ??
      payload?.result?.count ??
      0;
    return Number(n) || 0;
  };
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูลจาก API ตามหน้าและ filter*/
  const fetchPage = async (pageNo = 1, size = PAGE_SIZE) => {
    // Cancel previous request if exists
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    try {
      const params = {
        page: pageNo,
        limit: size,
        statusName: statusName || undefined,
        masterInvoiceNo: masterLot || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const resp = await httpClient.get(ENDPOINT_LIST, {
        ...authHeaders(),
        params,
        signal: ac.signal,
      });

      const data = resp?.data ?? {};
      const list = pluckRows(data);
      const ttl = pluckTotal(data);
      // Update status options from API response and rows
      const statusesFromPayload = Array.isArray(data?.statuses)
        ? data.statuses.map((s) =>
            typeof s === "string" ? s : s?.productStatusName ?? s?.value ?? ""
          )
        : [];
      const statusesFromRows = list.map((r) => r?.productStatusName ?? "");
      setStatusOptions((prev) =>
        buildStatusOptions([...statusesFromPayload, ...statusesFromRows], statusName, prev)
      );

      setRows(list);
      setTotal(ttl);
      setPage(pageNo);

      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      // Ignore canceled requests
      if (e?.name === "CanceledError" || e?.message === "canceled") {
        return;
      }
      console.error("[ProductLog] fetchPage error:", e);
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
      if (abortRef.current === ac) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchPage(1, PAGE_SIZE);
  }, [statusName, masterLot, dateFrom, dateTo]);
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
    const firstDate = rows[0]?.mfgDate ?? null;
    return toYMD(firstDate) || new Date().toISOString().slice(0, 10);
  }, [rows, dateFrom, dateTo]);
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  /*Export ข้อมูลเป็น CSV*/
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // กำหนด columns สำหรับ CSV
      const columns = [
        {key: "mfgDate",label: "mfgDate",render: (r) => fmtDate(pick(r.mfgDate, r.ProductDetails?.mfgDate)),},
        {key: "createdAt",label: "Time",render: (r) => fmtTime(pick(r.createdAt, r.updatedAt)),},
        {key: "status", label: "status", render: (r) => pick(r.productStatusName) },
        {key: "palletId", label: "palletid", render: (r) => pick(r.boxNo) },
        {key: "masterInvoiceNo",label: "masterInvoiceNo",render: (r) => pick(r.masterInvoiceNo, r.invoiceNo_MasterLot)},
        {key: "caseNo",label: "caseNo",render: (r) => pick(r.caseNo, r.ProductDetails?.caseNo)},
        {key: "poNo",label: "poNo",render: (r) => pick(r.poNo, r.nmbPoNo, r.ProductDetails?.poNo)},
        {key: "lotNo",label: "lotNo",render: (r) => pick(r.lotNo, r.ProductDetails?.lotNo)},
        {key: "itemName",label: "itemName",render: (r) => pick(r.itemName, r.ProductDetails?.itemName)},
        {key: "spec",label: "spec",render: (r) => pick(r.spec, r.ProductDetails?.spec)},
        {key: "size",label: "size",render: (r) => pick(r.size, r.ProductDetails?.size)},
        {key: "quantity",label: "quantity",render: (r) => pick(r.quantity, r.detailQuantity)},
        {key: "unit",label: "unit",render: (r) => pick(r.unit, r.ProductDetails?.unit)},
        {key: "currency",label: "currency",render: (r) => pick(r.currency, r.ProductDetails?.currency)},
        {key: "unitPrice",label: "unitPrice",render: (r) => pick(r.unitPrice, r.ProductDetails?.unitPrice)},
        {key: "amount",label: "amount",render: (r) => pick(r.amount, r.ProductDetails?.amount),},
        {key: "netWeight",label: "netWeight",render: (r) => pick(r.netWeight, r.ProductDetails?.netWeight)},
        {key: "grossWeight",label: "grossWeight",render: (r) => pick(r.grossWeight, r.ProductDetails?.grossWeight)},
        {key: "importEntryNo",label: "importEntryNo",render: (r) => pick(r.importEntryNo, r.ProductDetails?.importEntryNo)},
        {key: "locationCode",label: "locationCode",render: (r) => pick(r.locationCode)},
        {key: "vendorMasterName",label: "vendorMasterName",render: (r) => pick(r.vendorMasterName)},
      ];
      const paramsBase = {
        statusName: statusName || undefined,
        masterInvoiceNo: masterLot || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const batchSize = Math.max(PAGE_SIZE, 200);
      const allRows = [];
      const collectedStatuses = new Set();
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
          totalExpected = pluckTotal(payload);
        }
        // Collect statuses from payload
        if (Array.isArray(payload?.statuses)) {
          payload.statuses.forEach((s) => {
            if (typeof s === "string") {
              collectedStatuses.add(s);
            } else if (s?.productStatusName) {
              collectedStatuses.add(s.productStatusName);
            } else if (s?.value) {
              collectedStatuses.add(s.value);
            }
          });
        }
        // Collect statuses from rows
        pageRows.forEach((row) => {
          collectedStatuses.add(row?.productStatusName ?? "");
        });

        if (pageRows.length > 0) {
          allRows.push(...pageRows);
        }
        // เงื่อนไขหยุด loop
        const reachedTotal = totalExpected > 0 && allRows.length >= totalExpected;
        const noMoreData = pageRows.length === 0;
        const reachedPageCap = pageCursor >= maxPages;

        if (reachedTotal || noMoreData || reachedPageCap) break;

        pageCursor += 1;
      }
      // Update status options with collected statuses
      if (collectedStatuses.size > 0) {
        setStatusOptions((prev) =>
          buildStatusOptions(Array.from(collectedStatuses), statusName, prev)
        );
      }

      const exportRows = allRows.length > 0 ? allRows : rows;

      // สร้าง CSV content
      const lines = [];
      lines.push(columns.map((c) => escapeCsv(c.label)).join(",")); // Header row
      exportRows.forEach((r) => {
        const vals = columns.map((c) => escapeCsv(c.render ? c.render(r) : r[c.key]));
        lines.push(vals.join(","));
      });
      // สร้างไฟล์และดาวน์โหลด
      const csv = "\uFEFF" + lines.join("\r\n"); // BOM สำหรับ Excel
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `transaction_log_${fileDate}_p${pageCursor > 1 ? `all` : page}.csv`;
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ProductLog][exportCsv] error:", err);
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
    setStatusName("");
    setMasterLot("");
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
                    TRANSACTION LOG
                  </Link>
                </li>
              </ol>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void">Transaction Log</div>

            <div className="card-body gap-margin">
              {/* Filter Controls */}
              <div
                className="controls"
                style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
              >
                {/* Status Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 110 }}>
                    Status Name
                  </span>
                  <select
                    className="form-control angle"
                    value={statusName}
                    onChange={(e) => {
                      setStatusName(e.target.value);
                      setPage(1);
                    }}
                    style={{ minWidth: 240 }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value || "__all"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Master Invoice No Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 140 }}>
                    Master Invoice No.
                  </span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={masterLot}
                    onChange={(e) => {
                      setMasterLot(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g. KKM0823"
                    style={{ minWidth: 240 }}
                  />
                </label>
                <span style={{ flexBasis: "100%", height: 0 }} />

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
                    popperClassName="plog-popper"
                  />
                </label>

                {/* Date To */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 20 }}>to</span>
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
                    popperClassName="plog-popper"
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
                      <col className="col-plog-mfg" />
                      <col className="col-plog-created" />
                      <col className="col-plog-vendor" />
                      <col className="col-plog-pallet" />
                      <col className="col-plog-master" />
                      <col className="col-plog-case" />
                      <col className="col-plog-pono" />
                      <col className="col-plog-lot" />
                      <col className="col-plog-item" />
                      <col className="col-plog-spec" />
                      <col className="col-plog-size" />
                      <col className="col-plog-qty" />
                      <col className="col-plog-unit" />
                      <col className="col-plog-currency" />
                      <col className="col-plog-uprice" />
                      <col className="col-plog-amount" />
                      <col className="col-plog-netw" />
                      <col className="col-plog-grossw" />
                      <col className="col-plog-import" />
                      <col className="col-plog-location" />
                      <col className="col-plog-status" />
                    </colgroup>

                    <thead className="text-center">
                      <tr>
                        <th>mfgDate</th>
                        <th>Time</th>
                        <th>vendorMasterName</th>
                        <th>pallet ID</th>
                        <th>masterInvoiceNo</th>
                        <th>caseNo</th>
                        <th>poNo</th>
                        <th>lotNo</th>
                        <th>itemName</th>
                        <th>spec</th>
                        <th>size</th>
                        <th>quantity</th>
                        <th>unit</th>
                        <th>currency</th>
                        <th>unitPrice</th>
                        <th>amount</th>
                        <th>netWeight</th>
                        <th>grossWeight</th>
                        <th>importEntryNo</th>
                        <th>locationCode</th>
                        <th>status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={
                            r.productLogId ??
                            `${r.masterInvoiceNo}-${r.caseNo}-${r.palletNo}-${r.createdAt}`
                          }
                        >
                          <td>{fmtDate(r.createdAt)}</td>
                          <td>{fmtTime(r.createdAt)}</td>
                          <td>{r.vendorMasterName ?? "-"}</td>
                          <td>{r.boxNo ?? "-"}</td>
                          <td>{r.masterInvoiceNo ?? "-"}</td>
                          <td>{r.caseNo ?? "-"}</td>
                          <td>{r.poNo ?? "-"}</td>
                          <td>{r.lotNo ?? "-"}</td>
                          <td>{r.itemName ?? "-"}</td>
                          <td>{r.spec ?? "-"}</td>
                          <td>{r.size ?? "-"}</td>
                          <td>{r.quantity ?? "-"}</td>
                          <td>{r.unit ?? "-"}</td>
                          <td>{r.currency ?? "-"}</td>
                          <td>{r.unitPrice ?? "-"}</td>
                          <td>{r.amount ?? "-"}</td>
                          <td>{r.netWeight ?? "-"}</td>
                          <td>{r.grossWeight ?? "-"}</td>
                          <td>{r.importEntryNo ?? "-"}</td>
                          <td>{r.locationCode ?? "-"}</td>
                          <td>{r.productStatusName ?? "-"}</td>
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
