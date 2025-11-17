import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./PickingProductBalance.css";
import html2pdf from "html2pdf.js";

const ALL_LIMIT = 999999; // จำนวนรายการสูงสุดสำหรับดึงข้อมูลทั้งหมด
const ENDPOINT_SCAN_PICKING = "/api/v1/scanpicking/getdata"; // API endpoint สำหรับดึงข้อมูล picking

/*Component สำหรับแสดงตารางที่ใช้สำหรับพิมพ์ PDF*/
const PrintablePickingTable = React.forwardRef(({ rows, fmtDate, stockOutDateOf }, ref) => {
  const deliveryPlace = (rows && rows.length ? rows[0]?.deliveryTo : "") ?? "";
  const totalQty = (rows || []).reduce((s, r) => s + (Number(r?.quantity) || 0), 0);

  return (
    <div ref={ref} className="print-root">
      <div className="print-header">MATERIAL REQUISITION / CARGO DELIVERY</div>

      <div className="delivery-row">
        <span>DELIVERY PLACE</span>
        <span className="delivery-value">{deliveryPlace}</span>
      </div>

      <table className="print-table">
        <colgroup>
          <col style={{ width: "8%" }} />  {/* Vendor Code */}
          <col style={{ width: "16%" }} /> {/* Vendor Name */}
          <col style={{ width: "11%" }} /> {/* Stock-out Date */}
          <col style={{ width: "8%" }} />  {/* Delivery To */}
          <col style={{ width: "12%" }} /> {/* MasterInvoiceNo */}
          <col style={{ width: "11%" }} /> {/* PartialInvoice */}
          <col style={{ width: "8%" }} />  {/* ItemName */}
          <col style={{ width: "5%" }} />  {/* Qty */}
          <col style={{ width: "7%" }} />  {/* Case No */}
          <col style={{ width: "7%" }} />  {/* Location */}
          <col style={{ width: "7%" }} />  {/* Remark */}
        </colgroup>

        <thead>
          <tr>
            {[
              "Vendor Code",
              "Vendor Name",
              "Stock-out Date",
              "Delivery To",
              "MasterInvoiceNo",
              "Pallet ID",
              "PartialInvoice",
              "ItemName",
              "Qty",
              "Case No",
              "Location",
              "Remark",
            ].map((label) => (
              <th key={label} className="print-cell print-th">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={r.productBalanceId ?? `${r.masterInvoiceNo}-${r.caseNo}-${r.palletNo}-${i}`}>
              <td className="print-cell">{r.vendorMasterCode ?? ""}</td>
              <td className="print-cell">{r.vendorMasterName ?? ""}</td>
              <td className="print-cell">{fmtDate(stockOutDateOf(r))}</td>
              <td className="print-cell">{r.deliveryTo ?? ""}</td>
              <td className="print-cell">{r.masterInvoiceNo ?? ""}</td>
              <td className="print-cell">{r.ProductDetails?.boxNo ?? ""}</td>
              <td className="print-cell">{r.partialInvoice ?? ""}</td>
              <td className="print-cell">{r.itemName ?? ""}</td>
              <td className="print-cell">{r.quantity ?? ""}</td>
              <td className="print-cell">{r.caseNo ?? ""}</td>
              <td className="print-cell">{r.location ?? r.locationCode ?? r.locationId ?? ""}</td>
              <td className="print-cell">{r.remark ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-total">
        TOTAL&nbsp;&nbsp;
        <span style={{ padding: "0 8px", minWidth: 80, display: "inline-block" }}>
          {totalQty.toLocaleString()}
        </span>
      </div>

      <div className="print-checks">
        <div className="left">CHECK BY : {".".repeat(24)}</div>
        <div className="center">RECEIVE BY : {".".repeat(24)}</div>
        <div className="right">
          <span>DATE&nbsp;{".".repeat(24)}</span>
          <span>TIME&nbsp;{".".repeat(24)}</span>
        </div>
      </div>
    </div>
  );
});

export default function PickingProductBalance() {
  const [rows, setRows] = useState([]);  /*ข้อมูลรายการทั้งหมด*/
  const [loading, setLoading] = useState(false);  /*สถานะกำลังโหลดข้อมูล*/
  const [scanText, setScanText] = useState("");  /*ข้อความที่สแกนเข้ามา*/
  const tableRef = useRef(null);  /*Reference สำหรับตาราง*/
  const [vendor, setVendor] = useState("");  /*Vendor ที่เลือก (ว่าง = ทั้งหมด)*/
  const [partialInvoice, setPartialInvoice] = useState("");  /*Partial Invoice ที่เลือก (ว่าง = ทั้งหมด)*/
  const [deliveryTo, setDeliveryTo] = useState("");  /*Delivery To ที่เลือก (ว่าง = ทั้งหมด)*/
  const [printRows, setPrintRows] = useState([]);  /*ข้อมูลที่ใช้สำหรับพิมพ์ PDF*/
  const [exporting, setExporting] = useState(false);  /*สถานะกำลัง export CSV*/
  const printRef = useRef(null);  /*Reference สำหรับ component ที่ใช้พิมพ์ PDF*/

  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });

  // ============================================================================
  // HELPER FUNCTIONS - Data Processing
  // ============================================================================
  /*ดึง token ตัวแรกจากข้อความที่แยกด้วย tab (สำหรับสแกนเนอร์)*/
  const firstField = (v) => String(v ?? "").split("\t")[0].trim();
  /*แปลงวันที่เป็นรูปแบบ YYYY-MM-DD*/
  const toYMD = (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  /*แปลงวันที่เป็นรูปแบบที่อ่านง่าย (DD/MM/YYYY)*/
  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
  };
  /*ดึงวันที่ Stock-out จาก record (ลำดับความสำคัญ: stockOutDate > requestDate > receiveDate)*/
  const stockOutDateOf = (r) => r?.stockOutDate ?? r?.requestDate ?? r?.receiveDate ?? null;
  /*แปลงค่าเป็น string และ normalize (trim + lowercase)*/
  const normalize = (v) => String(v ?? "").trim().toLowerCase();

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*รายการ Vendor ที่มีในข้อมูล (เรียงตามตัวอักษร)*/
  const vendorOptions = useMemo(() => {
    const s = new Set();
    (rows || []).forEach((r) => {
      const v = String(r?.vendorMasterName ?? "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  }, [rows]);

  /*รายการ Partial Invoice ที่มีในข้อมูล (เรียงตามตัวอักษร)*/
  const partialInvoiceOptions = useMemo(() => {
    const s = new Set();
    (rows || []).forEach((r) => {
      const v = String(r?.partialInvoice ?? "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  }, [rows]);

  /*รายการ Delivery To ที่มีในข้อมูล (เรียงตามตัวอักษร)*/
  const deliveryToOptions = useMemo(() => {
    const s = new Set();
    (rows || []).forEach((r) => {
      const v = String(r?.deliveryTo ?? "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  }, [rows]);

  /*ข้อมูลที่กรองแล้วตาม filter (vendor, partialInvoice, deliveryTo)*/
  const viewRows = useMemo(() => {
    let base = rows;
    if (vendor) base = base.filter((r) => String(r.vendorMasterName ?? "") === vendor);
    if (partialInvoice) base = base.filter((r) => String(r.partialInvoice ?? "") === partialInvoice);
    if (deliveryTo) base = base.filter((r) => String(r.deliveryTo ?? "") === deliveryTo);
    return base;
  }, [rows, vendor, partialInvoice, deliveryTo]);

  /*วันที่สำหรับใช้ในชื่อไฟล์ (ใช้วันที่ Stock-out ของรายการแรก หรือวันนี้)*/
  const fileDate = useMemo(() => {
    const first = viewRows && viewRows.length ? stockOutDateOf(viewRows[0]) : null;
    const ymd = toYMD(first);
    return ymd || new Date().toISOString().slice(0, 10);
  }, [viewRows]);

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูล Product Balance จาก API*/
  const fetchProductBalance = async ({ q }) => {
    setLoading(true);
    try {
      const resp = await httpClient.get(ENDPOINT_SCAN_PICKING, {
        ...authHeaders(),
        params: { limit: ALL_LIMIT, q, all: 1 },
      });
      if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);

      const data = resp.data;
      const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      setRows(list);
    } catch (err) {
      console.error("[fetchProductBalance] error:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to load data",
        text: err?.message || "Unable to contact the server.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchProductBalance({ q: "" });
  }, []);

  // ============================================================================
  // EVENT HANDLERS - Export Functions
  // ============================================================================
  /*Export PDF โดยใช้ html2pdf.js*/
  const downloadPdf = async () => {
    const data = viewRows;
    if (!data.length) {
      Swal.fire({ icon: "info", title: "Nothing to export", text: "No rows found." });
      return;
    }
    setPrintRows(data);
    await new Promise((r) => requestAnimationFrame(r));

    const el = printRef.current;
    if (!el) {
      Swal.fire({ icon: "error", title: "ไม่พบเนื้อหาที่จะทำ PDF" });
      return;
    }

    const prev = {
      visibility: el.style.visibility,
      position: el.style.position,
      left: el.style.left,
    };
    el.style.visibility = "visible";
    el.style.position = "static";
    el.style.left = "auto";

    try {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `picking_list_${fileDate}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"], avoid: "tr" },
      };
      await html2pdf().set(opt).from(el).save();
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "Export PDF ล้มเหลว", text: e?.message || "ไม่ทราบสาเหตุ" });
    } finally {
      el.style.visibility = prev.visibility;
      el.style.position = prev.position;
      el.style.left = prev.left;
    }
  };

  /*Export CSV*/
  const escapeCsv = (value) => {
    const v = String(value ?? "").replace(/\r?\n/g, " ").replace(/\u0000/g, "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const exportCsv = async () => {
    if (exporting) {
      return;
    }

    try {
      setExporting(true);

      const columns = [
        { key: "vendorMasterCode", label: "Vendor Code" },
        { key: "vendorMasterName", label: "Vendor Name" },
        { key: "stockOutDate", label: "Stock-out Date", render: (r) => fmtDate(stockOutDateOf(r)) },
        { key: "deliveryTo", label: "Delivery To" },
        { key: "masterInvoiceNo", label: "MasterInvoiceNo" },
        { key: "partialInvoice", label: "PartialInvoice" },
        { key: "itemName", label: "ItemName" },
        { key: "quantity", label: "Qty" },
        { key: "caseNo", label: "Case No" },
        {
          key: "location",
          label: "Location",
          render: (r) => r.location ?? r.locationCode ?? r.locationId ?? "",
        },
        { key: "remark", label: "Remark" },
      ];

      const data = printRows.length ? printRows : viewRows;
      if (!data.length) {
        Swal.fire({ icon: "info", title: "No Data", text: "No rows to export." });
        return;
      }

      const lines = [];
      lines.push(columns.map((c) => escapeCsv(c.label)).join(","));

      data.forEach((r) => {
        const vals = columns.map((c) => {
          const raw = c.render ? c.render(r) : r[c.key];
          return escapeCsv(raw);
        });
        lines.push(vals.join(","));
      });

      const csv = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `picking_list_${fileDate}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[exportCsv] error:", err);
      Swal.fire({
        icon: "error",
        title: "Export failed",
        text: err?.message || "An error occurred while generating the file.",
      });
    } finally {
      setExporting(false);
    }
  };

  // ============================================================================
  // EVENT HANDLERS - Actions
  // ============================================================================
  /*ล้าง filter และข้อมูลที่สแกน*/
  const onClear = () => {
    setScanText("");
    fetchProductBalance({ q: "" });
    setVendor("");
    setPartialInvoice("");
    setDeliveryTo("");
  };

  /*ดึง Pallet No จากข้อความที่สแกน*/
  const extractPalletNo = (s) => {
    // ดึง token ตัวแรกก่อน \t (ถ้าสแกนเนอร์ส่งหลายช่องมาพร้อมกัน)
    const token = firstField(s);
    return token || null;
  };

  /*จัดการการสแกนและลบข้อมูล (Picking)*/
  const handleScanDelete = async () => {
    const palletNo = extractPalletNo(scanText);
    if (!palletNo) {
      Swal.fire({ icon: "warning", title: "Pallet No not found from scan", text: "Please scan again." });
      return;
    }

    // ตรวจสอบว่า Pallet No อยู่ในรายการที่กรองแล้วหรือไม่
    const foundInViewRows = viewRows.some(row => String(row.palletNo ?? "").trim() === palletNo);
    
    if (!foundInViewRows) {
      Swal.fire({ 
        icon: "warning", 
        title: "Pallet No not found in current view", 
        text: `Pallet No: ${palletNo} is not in the current filtered list. Please check your filters or scan a different pallet.`,
        timer: 900,
        showConfirmButton: false,
      });
      setScanText("");
      return;
    }

    try {
      setLoading(true);
      const resp = await httpClient.delete(`/api/v1/picking/deletadatabypalletno/${encodeURIComponent(palletNo)}`, authHeaders());
      const deletedCount = Number(resp?.data?.deletedCount ?? 0);
      Swal.fire({
        icon: deletedCount > 0 ? "success" : "info",
        title: deletedCount > 0 ? "Picking successful" : "Pallet No not found in Picking List",
        html: `Pallet No: <b>${palletNo}</b><br/>Picking: <b>${deletedCount}</b> item(s)`,
        timer: 1800,
        showConfirmButton: false,
      });
      await fetchProductBalance({ q: "" });
      setScanText("");
    } catch (err) {
      console.error("[handleScanDelete] error:", err);
      
      // ดึง error message จาก backend response
      let errorMessage = "An error occurred.";
      
      if (err?.response?.data && err.response.data.message) {
        // Backend error response with message field
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        // Generic error message
        errorMessage = err.message;
      }
      
      Swal.fire({ 
        icon: "error", 
        title: "Picking failed", 
        text: errorMessage 
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <>
      <div className="wrapper" style={{ overflowX: "hidden" }}>
        <div className="content-wrapper">
          <div className="container-fluid">
            {/* Breadcrumb */}
            <div className="row">
              <div className="col" style={{ marginTop: "5px" }}>
                <ol className="breadcrumb float-mb-left angle">
                  <li className="breadcrumb-item">OUTBOUND</li>
                  <li className="breadcrumb-item active">
                    <Link to="#" className="color-link">PICKING</Link>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-picking">SCAN PICKING</div>
            <div className="card-body gap-margin">
              {/* Filters and Controls */}
              <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {/* Vendor Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 60 }}>Vendor</span>
                  <div className="vp-input-wrap" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select className="form-control angle" value={vendor} onChange={(e) => setVendor(e.target.value)} style={{ minWidth: 220 }}>
                      <option key="__all__" value="">Select vendor</option>
                      {(vendorOptions || []).map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </label>

                {/* Partial Invoice Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span className="vp-label" style={{ minWidth: 115 }}>Partial Invoice</span>
                  <div className="vp-input-wrap" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select className="form-control angle" value={partialInvoice} onChange={(e) => setPartialInvoice(e.target.value)} style={{ minWidth: 200 }}>
                      <option key="__all__" value="">Select partial invoice</option>
                      {(partialInvoiceOptions || []).map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </label>

                {/* Delivery To Filter */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span className="vp-label" style={{ minWidth: 100 }}>Delivery To</span>
                  <div className="vp-input-wrap" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select className="form-control angle" value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} style={{ minWidth: 220 }}>
                      <option key="__all__" value="">Select delivery to</option>
                      {(deliveryToOptions || []).map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </label>

                {/* Line Break */}
                <div style={{ flexBasis: "100%", height: 0 }} />

                {/* Scan Input */}
                <input
                  className="scan-input form-control angle"
                  placeholder="Scan"
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      // เก็บ \t ที่สแกนเนอร์ยิงมา ไม่ให้โฟกัสกระโดด
                      setScanText((prev) => prev + "\t");
                      e.preventDefault();
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleScanDelete(); // ทำงานตอนสุดท้ายเหมือนเดิม
                    }
                  }}
                  autoFocus
                  style={{ maxWidth: 420 }}
                />

                {/* Clear Button */}
                <button className="btn btn-secondary angle" onClick={onClear} disabled={loading}>
                  Clear
                </button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Export CSV Button */}
                <button className="btn btn-success angle" onClick={exportCsv} disabled={loading || exporting || viewRows.length === 0}>
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>

                {/* Save PDF Button */}
                <button className="btn btn-danger angle" onClick={downloadPdf} disabled={loading || viewRows.length === 0} title="Save PDF">
                  Save PDF
                </button>
              </div>

              {/* Table */}
              <div className="table-wrapper mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : (
                  <table className="table table-receive table-custom table-compact">
                    <colgroup>
                      <col className="col-vendor-code" />
                      <col className="col-vendor-name" />
                      <col className="col-picking-pallet" />
                      <col className="col-picking-date" />
                      <col className="col-picking-delivery" />
                      <col className="col-picking-mi" />
                      <col className="col-picking-partial" />
                      <col className="col-picking-itemname" />
                      <col className="col-picking-qty" />
                      <col className="col-picking-case" />
                      <col className="col-picking-location" />
                      <col className="col-picking-remark" />
                    </colgroup>

                    <thead className="text-center">
                      <tr>
                        <th>Vendor Code</th>
                        <th>Vendor Name</th>
                        <th>Pallet ID</th>
                        <th>Stock-out Date</th>
                        <th>Delivery To</th>
                        <th>MasterInvoiceNo</th>
                        <th>PartialInvoice</th>
                        <th>ItemName</th>
                        <th>Qty</th>
                        <th>Case No</th>
                        <th>Location</th>
                        <th>Remark</th>
                      </tr>
                    </thead>

                    <tbody>
                      {viewRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="no-data-cell">📄 No Data</td>
                        </tr>
                      ) : (
                        viewRows.map((r, i) => (
                          <tr key={r.productBalanceId ?? `${r.masterInvoiceNo}-${r.caseNo}-${r.palletNo}-${i}`}>
                            <td>{r.vendorMasterCode ?? ""}</td>
                            <td>{r.vendorMasterName ?? ""}</td>
                            <td>{r.ProductDetails?.boxNo ?? ""}</td>
                            <td>{fmtDate(stockOutDateOf(r))}</td>
                            <td>{r.deliveryTo ?? ""}</td>
                            <td>{r.masterInvoiceNo ?? ""}</td>
                            <td>{r.partialInvoice ?? ""}</td>
                            <td>{r.itemName ?? ""}</td>
                            <td>{r.quantity ?? ""}</td>
                            <td>{r.caseNo ?? ""}</td>
                            <td>{r.location ?? r.locationCode ?? r.locationId ?? ""}</td>
                            <td>{r.remark ?? ""}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Total Count */}
              <div className="pager" style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <div>Total: <b>{viewRows.length.toLocaleString()}</b> items</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Portal (Hidden) */}
      <div className="print-portal">
        <PrintablePickingTable
          ref={printRef}
          rows={printRows.length ? printRows : viewRows}
          fmtDate={fmtDate}
          stockOutDateOf={stockOutDateOf}
        />
      </div>
    </>
  );
}
