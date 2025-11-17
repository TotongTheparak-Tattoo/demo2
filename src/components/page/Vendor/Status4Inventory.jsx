import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./Status4Inventory.css";

const PAGE_SIZE = 50;

export default function Status4Inventory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [masterInvoice, setMasterInvoice] = useState("");
  const [caseNo, setCaseNo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const tableRef = useRef(null);

  // ---------- Auth headers ----------
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });

  // ---------- Fetch data ----------
  const fetchData = async (pageNo = 1) => {
    setLoading(true);
    try {
      const params = {
        page: pageNo,
        limit: PAGE_SIZE,
        ...(masterInvoice && { masterInvoiceNo: masterInvoice }),
        ...(caseNo && { caseNo: caseNo }),
      };

      const response = await httpClient.get("/api/v1/productbalance/getbystatus4", {
        ...authHeaders(),
        params,
      });
      
      const data = response?.data ?? {};
      const list = Array.isArray(data.rows) ? data.rows : [];
      
      setRows(list);
      setTotal(data.total || 0);
      setPage(pageNo);
      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[Status4Inventory.fetchData] error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.message || "Failed to fetch data",
        confirmButtonColor: "#dc3545",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Clear filters ----------
  const onClear = () => {
    setMasterInvoice("");
    setCaseNo("");
    fetchData(1);
  };

  // ---------- Pagination ----------
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const goPrev = () => {
    if (page > 1) fetchData(page - 1);
  };

  const goNext = () => {
    if (page < totalPages) fetchData(page + 1);
  };

  // ---------- Delete handler ----------
  const handleDelete = async (productDetailsId) => {
    try {
      const result = await Swal.fire({
        title: "Confirm Delete",
        text: "Are you sure you want to delete this record?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      });

      if (result.isConfirmed) {
        setLoading(true);
        const response = await httpClient.delete(
          `/api/v1/productbalance/deletebyproductdetailsid/${productDetailsId}`,
          authHeaders()
        );

        await Swal.fire({
          icon: "success",
          title: "Deleted!",
          html: `
            <p>Data has been deleted successfully.</p>
          `,
          confirmButtonColor: "#28a745",
          timer: 1000,
          timerProgressBar: true,
        });

        // Refresh data
        await fetchData();
      }
    } catch (error) {
      console.error("[Status4Inventory.handleDelete] error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.message || "Failed to delete data",
        confirmButtonColor: "#dc3545",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Format date ----------
  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
  };

  // ---------- Load data on mount and when filters change ----------
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(1);
    }, 300); // Debounce 300ms
    
    return () => clearTimeout(timer);
  }, [masterInvoice, caseNo]); // Watch filter changes

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">VENDOR</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">Pre Information</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="status4-inventory">
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Pre Information
            </div>

            <div className="card-body gap-margin">
              <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 180 }}>Master Invoice</span>
                  <input 
                    type="text" 
                    className="form-control angle" 
                    value={masterInvoice} 
                    onChange={(e) => {
                      setMasterInvoice(e.target.value);
                      setPage(1);
                      fetchData(1);
                    }} 
                    placeholder="Search by Master Invoice No" 
                    style={{ minWidth: 200 }} 
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 100 }}>Case No</span>
                  <input 
                    type="text" 
                    className="form-control angle" 
                    value={caseNo} 
                    onChange={(e) => {
                      setCaseNo(e.target.value);
                      setPage(1);
                      fetchData(1);
                    }} 
                    placeholder="Search by Case No" 
                    style={{ minWidth: 150 }} 
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-secondary angle" onClick={onClear} disabled={loading}>Clear</button>
                </label>

                <div style={{ flex: 1 }} />

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-primary angle" onClick={() => fetchData(page)} disabled={loading}>
                    <i className="fas fa-sync-alt" /> Refresh
                  </button>
                </label>
              </div>

              <div className="table-wrapper table-h-scroll table-resize mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>📄 No Data</div>
                ) : (
                  <table className="table table-receive table-custom table-compact">
                    <colgroup>
                      <col className="col-status4-inventory-click" />
                      <col className="col-status4-inventory-date" />
                      <col className="col-status4-inventory-box-no" />
                      <col className="col-status4-inventory-master-invoice" />
                      <col className="col-status4-inventory-case-no" />
                      <col className="col-status4-inventory-item-name" />
                      <col className="col-status4-inventory-spec" />
                      <col className="col-status4-inventory-size" />
                      <col className="col-status4-inventory-qty" />
                      <col className="col-status4-inventory-unit" />
                      <col className="col-status4-inventory-vendor" />
                    </colgroup>
                    <thead className="text-center">
                      <tr>
                        <th>Action</th>
                        <th>MFG Date</th>
                        <th>Box No</th>
                        <th>Master Invoice</th>
                        <th>Case No</th>
                        <th>Item Name</th>
                        <th>Spec</th>
                        <th>Size</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Vendor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.productDetailsId}>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(row.productDetailsId)}
                              disabled={loading}
                              title="Delete"
                            >
                              <i className="fas fa-trash" />
                            </button>
                          </td>
                          <td>{fmtDate(row.mfgDate)}</td>
                          <td>{row.boxNo}</td>
                          <td>{row.masterInvoiceNo}</td>
                          <td>{row.caseNo}</td>
                          <td>{row.itemName}</td>
                          <td>{row.spec}</td>
                          <td>{row.size}</td>
                          <td>{row.quantity}</td>
                          <td>{row.unit}</td>
                          <td>{row.vendorMasterName || row.vendorMasterCode || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer / Pagination */}
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
                  <button className="btn btn-light angle" onClick={goPrev} disabled={!canPrev || loading}>
                    ◀ Prev
                  </button>

                  <span>
                    Page <b>{page}</b> / {totalPages.toLocaleString()}
                  </span>

                  <button className="btn btn-light angle" onClick={goNext} disabled={!canNext || loading}>
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

