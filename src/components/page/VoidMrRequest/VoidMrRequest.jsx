import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./VoidMrRequest.css";

const ENDPOINT_LIST = `/api/v1/voidmr/getdataallbymrnotnull`; // API endpoint สำหรับดึงข้อมูล MR Request
const ENDPOINT_VOID = (id) => `/api/v1/voidmr/updatedatabyid/${id}`; // API endpoint สำหรับ void MR Request ตาม ID

export default function VoidMrRequest() {
  const { state } = useLocation();  /*React Router location hook (สำหรับรับ state จาก navigation)*/
  const navigate = useNavigate();  /*React Router navigate hook*/
  const [allRows, setAllRows] = useState([]);  /*ข้อมูลรายการทั้งหมด*/
  const [loading, setLoading] = useState(false);  /*สถานะกำลังโหลดข้อมูล*/
  const [submitting, setSubmitting] = useState(false);  /*สถานะกำลัง void ข้อมูล*/
  const [selected, setSelected] = useState(() => new Set());  /*Set ของ ID ที่ถูกเลือก (ใช้ Set เพื่อประสิทธิภาพในการตรวจสอบ)*/
  /*Reference สำหรับตาราง (ใช้สำหรับ scroll)*/
  const tableRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });
  /*แปลง response จาก API ให้เป็น array ของ rows*/
  const pluckList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result)) return payload.result;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  // ============================================================================
  // HELPER FUNCTIONS - Date & Formatting
  // ============================================================================
  /*แปลงวันที่เป็นรูปแบบ DD/MM/YYYY (en-GB)*/
  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
  };
  /*แปลงวันที่และเวลาเป็นรูปแบบที่อ่านง่าย*/
  const fmtDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
  };
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูล MR Request ทั้งหมด*/
  const fetchAll = async () => {
    setLoading(true);
    try {
      const resp = await httpClient.get(ENDPOINT_LIST, authHeaders());
      const list = pluckList(resp?.data);
      setAllRows(list);
      setSelected(new Set()); // ล้างการเลือกเมื่อโหลดข้อมูลใหม่
      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[VoidMrRequest] fetchAll error:", e);
      setAllRows([]);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: e?.response?.data?.message || e?.message || "Failed to load data.",
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
    fetchAll();
  }, []);
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*จำนวนรายการทั้งหมด*/
  const total = allRows.length;
  /*จำนวนรายการที่เลือก*/
  const selectedCount = selected.size;
  /*ตรวจสอบว่าทุกรายการถูกเลือกหรือไม่*/
  const allSelected = total > 0 && selectedCount === total;
  /*ตรวจสอบว่ามีบางรายการถูกเลือกหรือไม่ (แต่ไม่ใช่ทั้งหมด)*/
  const someSelected = selectedCount > 0 && selectedCount < total;

  // ============================================================================
  // EVENT HANDLERS - Selection
  // ============================================================================
  /*สลับสถานะการเลือกของรายการ (toggle selection)*/
  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /*เลือก/ยกเลิกการเลือกทั้งหมด*/
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(allRows.map((r) => r.productBalanceId)));
  // ============================================================================
  // EVENT HANDLERS - Actions
  // ============================================================================
  /*Void รายการที่เลือก*/
  const onVoidSelected = async () => {
    if (selected.size === 0) {
      Swal.fire({ icon: "info", title: "No selection", text: "Please select at least one item." });
      return;
    }
    const ids = Array.from(selected);

    const confirm = await Swal.fire({
      title: "Confirm Void",
      html: `Do you want to void <b>${ids.length}</b> selected item(s)?<br/>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, void",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;

    try {
      setSubmitting(true);
      // ใช้ Promise.allSettled เพื่อ void ทุกรายการพร้อมกัน (ไม่หยุดเมื่อมีรายการใดล้มเหลว)
      const results = await Promise.allSettled(ids.map((id) => httpClient.patch(ENDPOINT_VOID(id), {}, authHeaders())));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;

      if (fail === 0) {
        await Swal.fire({ icon: "success", title: "Success", text: `Voided ${ok} item(s).` });
      } else if (ok > 0) {
        await Swal.fire({ icon: "warning", title: "Partial success", text: `Success ${ok} · Failed ${fail}` });
      } else {
        await Swal.fire({ icon: "error", title: "Error", text: "Void failed." });
      }
      await fetchAll(); // โหลดข้อมูลใหม่หลังจาก void
    } catch (err) {
      console.error("[VoidMrRequest] void error:", err);
      Swal.fire({ icon: "error", title: "Error", text: err?.message || "Void failed." });
    } finally {
      setSubmitting(false);
    }
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
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">Void MR Request</Link>
                </li>
              </ol>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void">Void MR Request</div>

            <div className="card-body gap-margin">
              {/* Summary and Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="vp-hint">
                  Rows: {total.toLocaleString()} · Selected: {selectedCount.toLocaleString()}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-danger angle"
                  onClick={onVoidSelected}
                  disabled={selected.size === 0 || submitting || loading}
                >
                  {submitting ? "Voiding..." : "Void Selected"}
                </button>
                <button
                  className="btn btn-secondary angle"
                  onClick={fetchAll}
                  disabled={loading || submitting}
                  title="Reload list"
                >
                  Reload
                </button>
              </div>

              {/* Table */}
              <div className="table-wrapper table-h-scroll mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : allRows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                    📄 No Data
                  </div>
                ) : (
                  <table className="table table-receive table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-vmr-check" />
                      <col className="col-vmr-master" />
                      <col className="col-vmr-partial" />
                      <col className="col-vmr-request" />
                      <col className="col-vmr-delivery" />
                      <col className="col-vmr-vendor" />
                      <col className="col-vmr-pallet" />
                      <col className="col-vmr-location" />
                      <col className="col-vmr-created" />
                      <col className="col-vmr-remark" />
                    </colgroup>

                    <thead className="text-center">
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected; }}
                            onChange={toggleAll}
                            disabled={loading || allRows.length === 0}
                          />
                        </th>
                        <th>masterInvoiceNo</th>
                        <th>partialInvoice</th>
                        <th>requestDate</th>
                        <th>deliveryTo</th>
                        <th>vendorMasterName</th>
                        <th>palletNo</th>
                        <th>location</th>
                        <th>createdAt</th>
                        <th>remark</th>
                      </tr>
                    </thead>

                    <tbody>
                      {allRows.map((r) => (
                        <tr key={r.productBalanceId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(r.productBalanceId)}
                              onChange={() => toggleRow(r.productBalanceId)}
                              disabled={submitting}
                            />
                          </td>
                          <td>{r.masterInvoiceNo ?? ""}</td>
                          <td>{r.partialInvoice ?? ""}</td>
                          <td>{fmtDate(r.requestDate)}</td>
                          <td>{r.deliveryTo ?? ""}</td>
                          <td>{r.vendorMasterName ?? ""}</td>
                          <td>{r.palletNo ?? "-"}</td>
                          <td>{r.locationCode ?? "-"}</td>
                          <td>{fmtDate(r.createdAt)}</td>
                          <td>{r.remark ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="vp-footer">
                <small>Tip: Use the top-left checkbox to select/deselect all.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
