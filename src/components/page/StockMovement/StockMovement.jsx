import React, { useEffect, useMemo, useRef, useState } from "react";
import { httpClient } from "../../../utils/HttpClient";
import "./StockMovement.css";

const PAGE_SIZE = 50; // จำนวนรายการต่อหน้า
const ENDPOINT = "/api/v1/stock/movement";

export default function StockMovement() {
  // Data state
  const [rows, setRows] = useState([]); // ข้อมูลรายการทั้งหมดในหน้าปัจจุบัน
  const [loading, setLoading] = useState(false); // สถานะกำลังโหลดข้อมูล
  const [exporting, setExporting] = useState(false); // สถานะกำลัง export CSV

  // Pagination state
  const [page, setPage] = useState(1); // หน้าปัจจุบัน
  const [total, setTotal] = useState(0); // จำนวนรายการทั้งหมด

  // Filter state
  const [vendorName, setVendorName] = useState(""); // Vendor ที่เลือก (ว่าง = ทั้งหมด)
  const [vendorOptions, setVendorOptions] = useState([{ value: "", label: "All vendors" }]); // รายการ Vendor ใน dropdown

  // UI refs
  const tableRef = useRef(null); // Reference สำหรับ scroll ตาราง

  // ============================================================================
  // HELPER FUNCTIONS - API & Data Normalization
  // ============================================================================
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });
  /*แปลง response จาก API ให้เป็น array ของ rows*/
  const pluckRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.result)) return payload.result;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  /*ดึงจำนวน total จาก response*/
  const pluckTotal = (payload) => {
    const n =
      payload?.result?.totalCount ??
      0;
    return Number(n) || 0;
  };
  // ============================================================================
  // HELPER FUNCTIONS - Date & Time Calculations
  // ============================================================================
  /*แปลงค่าเป็น Date object*/
  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  /*คำนวณจำนวนวันจากวันที่ที่กำหนดจนถึงวันนี้*/
  const diffDays = (from) => {
    const d = toDate(from);
    if (!d) return null;
    const ms = now.getTime() - d.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  };
  /*คำนวณจำนวนเดือนจากวันที่ที่กำหนดจนถึงวันนี้*/
  const diffMonths = (from) => {
    const d = toDate(from);
    if (!d) return null;
    const years = now.getFullYear() - d.getFullYear();
    const months = years * 12 + (now.getMonth() - d.getMonth());
    // ถ้าวันที่ยังไม่ถึงวันเดียวกันในเดือนนี้ ให้หัก 1 เดือน
    const adjust = now.getDate() < d.getDate() ? -1 : 0;
    return Math.max(0, months + adjust);
  };
  /*กำหนดประเภท Stock Movement ตามจำนวนเดือน*/
  const movementType = (from) => {
    const m = diffMonths(from);
    if (m == null) return "-";
    if (m < 6) return "< 6 months";
    if (m <= 12) return "6-12 months";
    return "> 12 months";
  };
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /**
   * ดึงข้อมูลจาก API ตามหน้าและ filter
   * @param {number} pageNo - หน้าที่ต้องการ (default: 1)
   * @param {number} size - จำนวนรายการต่อหน้า (default: PAGE_SIZE)
   */
  const fetchPage = async (pageNo = 1, size = PAGE_SIZE) => {
    setLoading(true);
    try {
      // เตรียม parameters สำหรับ API
      const params = {
        page: pageNo,
        limit: size,
        vendorName: vendorName || undefined, // ส่ง undefined ถ้าเป็น empty string
      };
      // เรียก API
      const resp = await httpClient.get(ENDPOINT, { ...authHeaders(), params });
      const payload = resp?.data ?? {};
      const list = pluckRows(payload);
      const ttl = pluckTotal(payload) || list.length;
      // อัปเดต state
      setRows(list);
      setTotal(ttl);
      setPage(pageNo);
      // อัปเดต vendor options จากข้อมูลที่ได้
      const candidates = (Array.isArray(list) ? list : [])
        .map((r) => String(r.vendorName ?? r.vendor ?? "").trim())
        .filter(Boolean);
      const seen = new Set(vendorOptions.map((o) => o.value));
      const merged = [...vendorOptions];
      candidates.forEach((name) => {
        if (!seen.has(name)) {
          seen.add(name);
          merged.push({ value: name, label: name });
        }
      });
      setVendorOptions(merged);
      // Scroll ไปด้านบนของตาราง
      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[StockMovement] fetchPage error:", e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchPage(1, PAGE_SIZE);
  }, [vendorName]);
  // ============================================================================
  // COMPUTED VALUES (useMemo)
  // ============================================================================
  /**
   * วันที่ปัจจุบัน (ใช้สำหรับคำนวณ days และ months)
   * Memoize เพื่อไม่ให้สร้างใหม่ทุกครั้ง render
   */
  const now = useMemo(() => new Date(), []);
  /*แปลง rows เป็น view data พร้อมคำนวณ days และ movement type*/
  const view = useMemo(() => {
    return (rows || []).map((r, idx) => {
      const stockInDate = r.stockInDate ?? null;
      return {
        id: idx,
        stockInDate,
        vendorName: r.vendorName ?? r.vendor ?? "",
        invoiceNo: r.invoiceNo ?? r.masterLot ?? r.masterInvoiceNo ?? "",
        boxNo: r.boxNo ?? "",
        caseNo: r.caseNo ?? "",
        poNo: r.poNo ?? "",
        lotNo: r.lotNo ?? "",
        location: r.locationCode ?? r.location ?? "",
        days: diffDays(stockInDate),
        type: movementType(stockInDate),
      };
    });
  }, [rows, now]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE)), [total]);
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
        {
          key: "stockInDate",
          label: "StockInDate",
          render: (r) => (r.stockInDate || "").toString().slice(0, 10),
        },
        {
          key: "vendorName",
          label: "Vendor Name",
          render: (r) => r.vendorName || "",
        },
        { key: "invoiceNo", label: "Invoice No" },
        { key: "boxNo", label: "Pallet ID" },
        { key: "caseNo", label: "Case No" },
        { key: "poNo", label: "PO No" },
        { key: "lotNo", label: "Lot No" },
        {
          key: "locationCode",
          label: "Location",
          render: (r) => r.locationCode || "",
        },
        {
          key: "daysCalc",
          label: "Day",
          render: (r) => {
            const s = r.stockInDate;
            if (!s) return "";
            const d = new Date(s);
            if (isNaN(d.getTime())) return "";
            const ms = new Date().getTime() - d.getTime();
            return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
          },
        },
        {
          key: "typeCalc",
          label: "StockMovementType",
          render: (r) => {
            const s = r.stockInDate;
            if (!s) return "-";
            const d = new Date(s);
            if (isNaN(d.getTime())) return "-";
            const nowD = new Date();
            const years = nowD.getFullYear() - d.getFullYear();
            const months =
              years * 12 + (nowD.getMonth() - d.getMonth()) + (nowD.getDate() < d.getDate() ? -1 : 0);
            if (months < 6) return "< 6 months";
            if (months <= 12) return "6-12 months";
            return "> 12 months";
          },
        },
      ];

      // เตรียม parameters สำหรับ API
      const paramsBase = { vendorName: vendorName || undefined };
      const batchSize = Math.max(PAGE_SIZE, 200); // ใช้ batch size ใหญ่ขึ้นเพื่อลดจำนวน requests
      const allRows = [];
      let pageCursor = 1;
      let totalExpected = 0;
      const maxPages = 500; // จำกัดจำนวนหน้าสูงสุดเพื่อป้องกัน infinite loop

      // ดึงข้อมูลทั้งหมดจากทุกหน้า
      while (true) {
        const resp = await httpClient.get(ENDPOINT, {
          ...authHeaders(),
          params: { ...paramsBase, page: pageCursor, limit: batchSize },
        });
        const payload = resp?.data ?? {};
        const pageRows = pluckRows(payload);

        // เก็บ total จากหน้าแรก
        if (pageCursor === 1) totalExpected = pluckTotal(payload) || pageRows.length || 0;

        // เพิ่ม rows เข้า allRows
        if (Array.isArray(pageRows) && pageRows.length) allRows.push(...pageRows);

        // เงื่อนไขหยุด loop
        const reachedTotal = totalExpected > 0 && allRows.length >= totalExpected;
        const noMoreData = !Array.isArray(pageRows) || pageRows.length < batchSize;
        const reachedPageCap = pageCursor >= maxPages;

        if (reachedTotal || noMoreData || reachedPageCap) break;

        pageCursor += 1;
      }

      // ใช้ข้อมูลที่ดึงมา หรือ fallback ไปใช้ rows ปัจจุบัน
      const exportRows = allRows.length > 0 ? allRows : rows;
      if (!exportRows.length) return;
      const escapeCsv = (value) => {
        const v = String(value ?? "").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      };

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
      const filename = `stock_movement_${vendorName || "all"}_${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[StockMovement][exportCsv] error:", err);
    } finally {
      setExporting(false);
    }
  };
  /*Handler สำหรับเปลี่ยนหน้า (Previous)*/
  const goPrev = () => {
    if (page > 1) fetchPage(page - 1);
  };
  /*Handler สำหรับเปลี่ยนหน้า (Next)*/
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
                  <a href="/vmi-report-menu" className="color-link">
                    Logistics Report
                  </a>
                </li>
                <li className="breadcrumb-item">
                  <a href="#" className="color-link">
                    STOCK MOVEMENT
                  </a>
                </li>
              </ol>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Stock Movement
            </div>

            <div className="card-body gap-margin stock-movement">
              {/* Filter & Action Controls */}
              <div
                className="controls"
                style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
              >
                {/* Vendor Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 110 }}>
                    Vendor Name
                  </span>
                  <select
                    className="form-control angle"
                    value={vendorName}
                    onChange={(e) => {
                      setVendorName(e.target.value);
                      setPage(1);
                    }}
                    style={{ minWidth: 220 }}
                  >
                    {vendorOptions.map((opt) => (
                      <option key={opt.value || "__all"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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

                {/* Refresh Button */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-secondary angle"
                    onClick={() => fetchPage(page, PAGE_SIZE)}
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Refresh"}
                  </button>
                </label>
              </div>

              {/* Data Table */}
              <div
                className="table-wrapper table-h-scroll table-resize mt-3 stock-movement-tablewrap"
                ref={tableRef}
              >
                <table
                  className="table table-custom table-compact table-wide stock-movement"
                  style={{ fontSize: 13, marginBottom: 0 }}
                >
                  <colgroup>
                    <col className="col-smov-stockin" />
                    <col className="col-smov-vendor" />
                    <col className="col-smov-invoice" />
                    <col className="col-smov-box" />
                    <col className="col-smov-case" />
                    <col className="col-smov-pono" />
                    <col className="col-smov-lot" />
                    <col className="col-smov-location" />
                    <col className="col-smov-day" />
                    <col className="col-smov-type" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>StockInDate</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Vendor Name</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Invoice No</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Pallet ID</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Case No</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>PO No</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Lot No</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Location</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Day</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        StockMovementType
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Data Rows */}
                    {view.map((r) => (
                      <tr key={r.id}>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          {r.stockInDate ? String(r.stockInDate).slice(0, 10) : ""}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{r.vendorName}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{r.invoiceNo}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.boxNo}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.caseNo}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.poNo}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.lotNo}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.location}</td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          {r.days ?? ""}
                        </td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          {r.type === "< 6 months" && (
                            <span className="badge-type badge-lt6">{r.type}</span>
                          )}
                          {r.type === "6-12 months" && (
                            <span className="badge-type badge-6to12">{r.type}</span>
                          )}
                          {r.type === "> 12 months" && (
                            <span className="badge-type badge-gt12">{r.type}</span>
                          )}
                          {r.type !== "< 6 months" &&
                            r.type !== "6-12 months" &&
                            r.type !== "> 12 months" &&
                            r.type}
                        </td>
                      </tr>
                    ))}

                    {/* Empty State */}
                    {!loading && view.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: 16 }}>
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                <div
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <button
                    className="btn btn-light angle"
                    onClick={goPrev}
                    disabled={loading || page <= 1}
                  >
                    ◀ Prev
                  </button>
                  <span>
                    Page <b>{page}</b> / {totalPages.toLocaleString()}
                  </span>
                  <button
                    className="btn btn-light angle"
                    onClick={goNext}
                    disabled={loading || page >= totalPages}
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
