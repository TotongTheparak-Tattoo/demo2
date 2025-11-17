import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./EditMonthlyData.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PAGE_SIZE = 50;

export default function EditMonthlyData() {
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const tableRef = useRef(null);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [importerNameEN, setImporterNameEN] = useState("");

  const endpointList = "/api/v1/monthlydata/getdata";
  const endpointUpdate = "/api/v1/monthlydata/update";

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
  const pluckTotal = (payload) => {
    const n = payload?.total ?? payload?.count ?? payload?.pagination?.total ?? payload?.result?.total ?? payload?.result?.count ?? 0;
    return Number(n) || 0;
  };

  // --- Date helpers ---
  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
  };
  
  const fmtThaiDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    
    // Convert to Thai Buddhist Era
    const thaiYear = d.getFullYear() + 543;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    
    return `${day}/${month}/${thaiYear}`;
  };
  
  const fmtTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const fetchPage = async (pageNo = 1, size = PAGE_SIZE) => {
    setLoading(true);
    try {
      const params = {
        page: pageNo,
        limit: size,
        invoiceNo: invoiceNo || undefined,
        itemNo: itemNo || undefined,
        importerNameEN: importerNameEN || undefined,
      };
      const resp = await httpClient.get(endpointList, { ...authHeaders(), params });
      const data = resp?.data ?? {};
      const list = pluckRows(data);
      const ttl = pluckTotal(data);

      setRows(list);
      setTotal(ttl || list.length);
      setPage(pageNo);
      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[EditMonthlyData] fetchPage error:", e);
      setRows([]);
      setTotal(0);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: e?.response?.data?.message || e?.message || "Could not contact the server or load data.",
        confirmButtonText: "OK",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1, PAGE_SIZE);
  }, [invoiceNo, itemNo, importerNameEN]);

  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const handleEdit = (row) => {
    setEditingRow(row.monthlyDataId);
    setEditData({ ...row });
    setShowModal(true);
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditData({});
    setShowModal(false);
  };

  const handleSave = async () => {
    if (!editingRow) return;

    setSaving(true);
    try {
      const response = await httpClient.post(endpointUpdate, editData, authHeaders());
      
      if (response.data?.result?.message) {
        await Swal.fire({
          icon: "success",
          title: "Success",
          text: response.data.result.message,
          confirmButtonText: "OK",
          timer: 2000,
          timerProgressBar: true,
        });
        
        setEditingRow(null);
        setEditData({});
        setShowModal(false);
        fetchPage(page, PAGE_SIZE); // Refresh current page
      }
    } catch (error) {
      console.error("[EditMonthlyData] Save error:", error);
      await Swal.fire({
        icon: "error",
        title: "Save failed",
        text: error?.response?.data?.message || error?.message || "Could not save data.",
        confirmButtonText: "OK",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const onClear = () => {
    setInvoiceNo("");
    setItemNo("");
    setImporterNameEN("");
    setPage(1);
  };

  const goPrev = () => { if (page > 1) fetchPage(page - 1); };
  const goNext = () => { if (page < totalPages) fetchPage(page + 1); };

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">MASTER</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">EDIT MONTHLY DATA</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-picking" style={{ textAlign: "center" }}>
              Edit Monthly Data
            </div>

            <div className="card-body gap-margin">
              <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 100 }}>Invoice No</span>
                  <input 
                    type="text" 
                    className="form-control angle" 
                    value={invoiceNo} 
                    onChange={(e) => { setInvoiceNo(e.target.value); setPage(1); }} 
                    placeholder="Search by Invoice No" 
                    style={{ minWidth: 150 }} 
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 80 }}>Item No</span>
                  <input 
                    type="text" 
                    className="form-control angle" 
                    value={itemNo} 
                    onChange={(e) => { setItemNo(e.target.value); setPage(1); }} 
                    placeholder="Search by Item No" 
                    style={{ minWidth: 120 }} 
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 120 }}>Importer NameEN</span>
                  <input 
                    type="text" 
                    className="form-control angle" 
                    value={importerNameEN} 
                    onChange={(e) => { setImporterNameEN(e.target.value); setPage(1); }} 
                    placeholder="Search by Importer" 
                    style={{ minWidth: 150 }} 
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-secondary angle" onClick={onClear} disabled={loading}>Clear</button>
                </label>
              </div>

              <div className="table-wrapper table-h-scroll table-resize mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>📄 No Data</div>
                ) : (
                  <table className="table table-receive table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-edit-actions" />
                      <col className="col-edit-inv" />
                      <col className="col-edit-item" />
                      <col className="col-edit-importer" />
                      <col className="col-edit-desc" />
                      <col className="col-edit-qty" />
                      <col className="col-edit-unit" />
                      <col className="col-edit-netw" />
                      <col className="col-edit-netwunit" />
                      <col className="col-edit-curr" />
                      <col className="col-edit-amount" />
                      <col className="col-edit-cifthb" />
                      <col className="col-edit-dutyrate" />
                      <col className="col-edit-dutyamt" />
                      <col className="col-edit-tariff" />
                      <col className="col-edit-ctrldec" />
                      <col className="col-edit-consctry" />
                      <col className="col-edit-grossw" />
                      <col className="col-edit-grosswunit" />
                      <col className="col-edit-netw2" />
                      <col className="col-edit-netwunit2" />
                      <col className="col-edit-currcode" />
                      <col className="col-edit-invcurr" />
                      <col className="col-edit-arrival" />
                    </colgroup>
                    <thead className="text-center">
                      <tr>
                        <th>Actions</th>
                        <th>Invoice No</th>
                        <th>Item No</th>
                        <th>Importer NameEN</th>
                        <th>Desc.</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Net Weight</th>
                        <th>Net Weight Unit</th>
                        <th>Curr.</th>
                        <th>Amount</th>
                        <th>CIF THB</th>
                        <th>Duty Rate</th>
                        <th>Duty Amt</th>
                        <th>Tariff</th>
                        <th>Ctrl Declaration No</th>
                        <th>Consignment Country</th>
                        <th>Gross Weight</th>
                        <th>Gross Weight Unit</th>
                        <th>Net Weight 2</th>
                        <th>Net Weight Unit 2</th>
                        <th>Currency Code</th>
                        <th>Invoice Currency</th>
                        <th>Arrival Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.monthlyDataId ?? i}>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleEdit(r)}
                              disabled={editingRow !== null}
                            >
                              Edit
                            </button>
                          </td>
                          <td>{r.invoiceNo ?? "-"}</td>
                          <td>{r.itemNo ?? "-"}</td>
                          <td>{r.importerNameEN ?? "-"}</td>
                          <td>{r.description ?? "-"}</td>
                          <td>{r.quantity ?? "-"}</td>
                          <td>{r.unit ?? "-"}</td>
                          <td>{r.netWeight ?? "-"}</td>
                          <td>{r.netWeightUnit ?? "-"}</td>
                          <td>{r.currency ?? "-"}</td>
                          <td>{r.amount ?? "-"}</td>
                          <td>{r.cifTHB ?? "-"}</td>
                          <td>{r.dutyRate ?? "-"}</td>
                          <td>{r.dutyAmt ?? "-"}</td>
                          <td>{r.tariff ?? "-"}</td>
                          <td>{r.ctrlDeclarationNo ?? "-"}</td>
                          <td>{r.consignmentCountry ?? "-"}</td>
                          <td>{r.grossWeight ?? "-"}</td>
                          <td>{r.grossWeightUnit ?? "-"}</td>
                          <td>{r.netWeight2 ?? "-"}</td>
                          <td>{r.netWeightUnit2 ?? "-"}</td>
                          <td>{r.currencyCode ?? "-"}</td>
                          <td>{r.invoiceCurrency ?? "-"}</td>
                          <td>{fmtThaiDate(r.arrivalDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontStyle: "italic" }}>
                  Total rows: {Number(total || 0).toLocaleString()}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="btn btn-light angle" onClick={goPrev} disabled={!canPrev || loading}>◀ Prev</button>
                  <span>Page <b>{page}</b> / {totalPages.toLocaleString()}</span>
                  <button className="btn btn-light angle" onClick={goNext} disabled={!canNext || loading}>Next ▶</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content" style={{ maxHeight: '90vh' }}>
              <div className="modal-header">
                <h5 className="modal-title">Edit Monthly Data</h5>
                <button type="button" className="btn-close" onClick={handleCancelEdit}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Invoice No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.invoiceNo || ""}
                        onChange={(e) => handleInputChange("invoiceNo", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Item No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.itemNo || ""}
                        onChange={(e) => handleInputChange("itemNo", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Importer NameEN</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.importerNameEN || ""}
                        onChange={(e) => handleInputChange("importerNameEN", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.description || ""}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.quantity || ""}
                        onChange={(e) => handleInputChange("quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Unit</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.unit || ""}
                        onChange={(e) => handleInputChange("unit", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Net Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.netWeight || ""}
                        onChange={(e) => handleInputChange("netWeight", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Net Weight Unit</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.netWeightUnit || ""}
                        onChange={(e) => handleInputChange("netWeightUnit", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Currency</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.currency || ""}
                        onChange={(e) => handleInputChange("currency", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.amount || ""}
                        onChange={(e) => handleInputChange("amount", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">CIF THB</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.cifTHB || ""}
                        onChange={(e) => handleInputChange("cifTHB", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Duty Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.dutyRate || ""}
                        onChange={(e) => handleInputChange("dutyRate", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Duty Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.dutyAmt || ""}
                        onChange={(e) => handleInputChange("dutyAmt", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Tariff</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.tariff || ""}
                        onChange={(e) => handleInputChange("tariff", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Ctrl Declaration No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.ctrlDeclarationNo || ""}
                        onChange={(e) => handleInputChange("ctrlDeclarationNo", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Consignment Country</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.consignmentCountry || ""}
                        onChange={(e) => handleInputChange("consignmentCountry", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Gross Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.grossWeight || ""}
                        onChange={(e) => handleInputChange("grossWeight", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Gross Weight Unit</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.grossWeightUnit || ""}
                        onChange={(e) => handleInputChange("grossWeightUnit", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Net Weight 2</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={editData.netWeight2 || ""}
                        onChange={(e) => handleInputChange("netWeight2", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Net Weight Unit 2</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.netWeightUnit2 || ""}
                        onChange={(e) => handleInputChange("netWeightUnit2", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Currency Code</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.currencyCode || ""}
                        onChange={(e) => handleInputChange("currencyCode", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Invoice Currency</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.invoiceCurrency || ""}
                        onChange={(e) => handleInputChange("invoiceCurrency", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Arrival Date</label>
                      <DatePicker
                        selected={editData.arrivalDate ? new Date(editData.arrivalDate) : null}
                        onChange={(date) => handleInputChange("arrivalDate", date)}
                        dateFormat="dd/MM/yyyy"
                        className="form-control"
                        placeholderText="Select arrival date"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
