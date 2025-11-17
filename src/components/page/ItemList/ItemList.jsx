import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./ItemList.css";

const PAGE_SIZE = 50;

export default function ItemList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [spec, setSpec] = useState("");
  const [size, setSize] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("itemlist"); // 'itemlist' or 'unmatched'
  const [unmatchedData, setUnmatchedData] = useState(null);
  const [loadingUnmatched, setLoadingUnmatched] = useState(false);
  const [unmatchedSearch, setUnmatchedSearch] = useState(""); // For searching in unmatched products
  const [filteredUnmatched, setFilteredUnmatched] = useState([]);
  const [exporting, setExporting] = useState(false);
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
        ...(spec && { spec: spec }),
        ...(size && { size: size }),
      };

      const response = await httpClient.get("/api/v1/itemlist/getall", {
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
      console.error("[ItemList.fetchData] error:", error);
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

  // ---------- Fetch unmatched products ----------
  const fetchUnmatchedProducts = async () => {
    setLoadingUnmatched(true);
    try {
      const response = await httpClient.get("/api/v1/itemlist/unmatched-products", {
        ...authHeaders(),
      });
      
      const data = response?.data?.result ?? {};
      setUnmatchedData(data);
      setFilteredUnmatched(data.unmatchedProducts || []);
    } catch (error) {
      console.error("[ItemList.fetchUnmatchedProducts] error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.message || "Failed to fetch unmatched products",
        confirmButtonColor: "#dc3545",
      });
    } finally {
      setLoadingUnmatched(false);
    }
  };

  // ---------- Filter unmatched products ----------
  const filterUnmatchedProducts = useCallback((searchTerm) => {
    if (!searchTerm || !unmatchedData?.unmatchedProducts) {
      setFilteredUnmatched(unmatchedData?.unmatchedProducts || []);
      return;
    }

    const search = searchTerm.toLowerCase();
    const filtered = unmatchedData.unmatchedProducts.filter((product) => {
      const masterInvoiceNo = String(product.masterInvoiceNo || "").toLowerCase();
      const boxNo = String(product.boxNo || "").toLowerCase();
      const caseNo = String(product.caseNo || "").toLowerCase();
      const poNo = String(product.poNo || "").toLowerCase();
      const lotNo = String(product.lotNo || "").toLowerCase();
      const itemName = String(product.itemName || "").toLowerCase();
      const spec = String(product.spec || "").toLowerCase();
      const size = String(product.size || "").toLowerCase();
      
      return (
        masterInvoiceNo.includes(search) ||
        boxNo.includes(search) ||
        caseNo.includes(search) ||
        poNo.includes(search) ||
        lotNo.includes(search) ||
        itemName.includes(search) ||
        spec.includes(search) ||
        size.includes(search)
      );
    });
    
    setFilteredUnmatched(filtered);
  }, [unmatchedData]);

  // ---------- Export to CSV ----------
  const exportToCSV = async () => {
    if (exporting) {
      return;
    }

    if (!filteredUnmatched || filteredUnmatched.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No Data",
        text: "No data to export",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    try {
      setExporting(true);

      const headers = [
        "ID",
        "Box No",
        "Master Invoice No",
        "Case No",
        "PO No",
        "Lot No",
        "Heat No",
        "Item Name",
        "Spec",
        "Size",
        "Width",
        "Quantity",
        "Unit",
        "Currency",
        "Unit Price",
        "Amount",
        "Net Weight",
        "Gross Weight",
        "Import Entry No",
        "Remark",
        "Vendor ID",
        "MFG Date"
      ];

      const escapeField = (field) => {
        const str = String(field ?? "");
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = filteredUnmatched.map((product) => { 
        return [
          product.productDetailsId,
          product.boxNo,
          product.masterInvoiceNo,
          product.caseNo,
          product.poNo,
          product.lotNo,
          product.heatNo,
          product.itemName,
          product.spec,
          product.size,
          product.width,
          product.quantity,
          product.unit,
          product.currency,
          product.unitPrice,
          product.amount,
          product.netWeight,
          product.grossWeight,
          product.importEntryNo,
          product.remark,
          product.vendorMasterId,
          product.mfgDate,
        ].map(escapeField);
      });

      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `unmatched-products-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        icon: "success",
        title: "Export Successful",
        text: `Exported ${filteredUnmatched.length} records to CSV`,
        confirmButtonColor: "#28a745",
        timer: 2000,
      });
    } catch (error) {
      console.error("[ItemList][exportToCSV] error:", error);
      Swal.fire({ icon: "error", title: "Export failed", text: error?.message || "Unable to export CSV." });
    } finally {
      setExporting(false);
    }
  };

  // ---------- Clear filters ----------
  const onClear = () => {
    setSpec("");
    setSize("");
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

  // ---------- Add column resize functionality ----------
  useEffect(() => {
    const addResizeHandles = () => {
      const tables = document.querySelectorAll('.item-list-table-wrapper table.table-custom');
      
      tables.forEach(table => {
        const thead = table.querySelector('thead');
        if (!thead) return;
        
        const headers = thead.querySelectorAll('th');
        
        headers.forEach((header, index) => {
          // Skip if already has resizer
          if (header.querySelector('.resizer')) return;
          
          const resizer = document.createElement('div');
          resizer.className = 'resizer';
          resizer.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 5px;
            height: 100%;
            cursor: col-resize;
            user-select: none;
            background: transparent;
            z-index: 10;
          `;
          
          header.style.position = 'relative';
          header.appendChild(resizer);
          
          let isResizing = false;
          let startX = 0;
          let startWidth = 0;
          
          const handleMouseDown = (e) => {
            isResizing = true;
            startX = e.pageX;
            startWidth = header.offsetWidth;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            e.preventDefault();
          };
          
          const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const width = startWidth + e.pageX - startX;
            if (width >= 60) { // Minimum width
              header.style.width = width + 'px';
              
              // Update corresponding col element if exists
              const cols = table.querySelectorAll('col');
              if (cols[index]) {
                cols[index].style.width = width + 'px';
              }
            }
          };
          
          const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          resizer.addEventListener('mousedown', handleMouseDown);
        });
      });
    };
    
    // Add resize handles when table is rendered
    const timer = setTimeout(addResizeHandles, 100);
    
    return () => clearTimeout(timer);
  }, [rows, filteredUnmatched, activeTab]);

  // ---------- Load data on mount and when filters change ----------
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(1);
    }, 300); // Debounce 300ms
    
    return () => clearTimeout(timer);
  }, [spec, size]); // Watch filter changes

  // ---------- Load unmatched products when tab changes ----------
  useEffect(() => {
    if (activeTab === "unmatched" && !unmatchedData) {
      fetchUnmatchedProducts();
    }
  }, [activeTab]);

  // ---------- Filter unmatched products when search term changes ----------
  useEffect(() => {
    filterUnmatchedProducts(unmatchedSearch);
  }, [unmatchedSearch, filterUnmatchedProducts]);

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">MASTER DATA</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">ITEM LIST</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="item-list-container">
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Item List
            </div>

            {/* Tabs */}
            <div style={{ display: "" }}>
              <button
                className={`btn ${activeTab === "itemlist" ? "btn-primary" : "btn-light"}`}
                onClick={() => setActiveTab("itemlist")}
                style={{ minWidth: 150 }}
              >
                Item List
              </button>
              <button
                className={`btn ${activeTab === "unmatched" ? "btn-danger" : "btn-light"}`}
                onClick={() => setActiveTab("unmatched")}
                style={{ minWidth: 150 }}
              >
                Unmatched Products
              </button>
            </div>

            <div className="card-body gap-margin">
              {/* Item List Tab Content */}
              {activeTab === "itemlist" && (
                <>
                  <div className="controls">
                    <label className="vp-field">
                      <span className="vp-label" style={{ minWidth: 120 }}>Spec</span>
                      <input 
                        type="text" 
                        className="form-control angle" 
                        value={spec} 
                        onChange={(e) => {
                          setSpec(e.target.value);
                          setPage(1);
                          fetchData(1);
                        }} 
                        placeholder="Search by Spec" 
                        style={{ minWidth: 150 }} 
                      />
                    </label>

                    <label className="vp-field">
                      <span className="vp-label" style={{ minWidth: 80 }}>Size</span>
                      <input 
                        type="text" 
                        className="form-control angle" 
                        value={size} 
                        onChange={(e) => {
                          setSize(e.target.value);
                          setPage(1);
                          fetchData(1);
                        }} 
                        placeholder="Search by Size" 
                        style={{ minWidth: 150 }} 
                      />
                    </label>

                    <label className="vp-field">
                      <button className="btn btn-secondary angle" onClick={onClear} disabled={loading}>Clear</button>
                    </label>

                    <div style={{ flex: 1 }} />

                    <label className="vp-field">
                      <button className="btn btn-primary angle" onClick={() => fetchData(page)} disabled={loading}>
                        <i className="fas fa-sync-alt" /> Refresh
                      </button>
                    </label>
                  </div>
                </>
              )}

              {/* Unmatched Products Tab Content */}
              {activeTab === "unmatched" && (
                <>
                  <div className="controls" style={{ marginBottom: 10 }}>
                    <label className="vp-field" style={{ minWidth: 300 }}>
                      <span className="vp-label" style={{ minWidth: 140 }}>Search (Master Invoice, Case No, etc.)</span>
                      <input 
                        type="text" 
                        className="form-control angle" 
                        value={unmatchedSearch} 
                        onChange={(e) => setUnmatchedSearch(e.target.value)} 
                        placeholder="Enter search term..." 
                        style={{ flex: 1 }} 
                      />
                    </label>

                    <label className="vp-field">
                      <button className="btn btn-secondary angle" onClick={() => setUnmatchedSearch("")} disabled={loadingUnmatched}>
                        Clear
                      </button>
                    </label>

                    <div style={{ flex: 1 }} />

                    <label className="vp-field">
                      <button className="btn btn-success angle" onClick={exportToCSV} disabled={loadingUnmatched || exporting || !filteredUnmatched || filteredUnmatched.length === 0}>
                        <i className="fas fa-file-csv" /> {exporting ? "Exporting..." : "Export CSV"}
                      </button>
                    </label>

                    <label className="vp-field">
                      <button className="btn btn-primary angle" onClick={fetchUnmatchedProducts} disabled={loadingUnmatched}>
                        <i className="fas fa-sync-alt" /> Refresh
                      </button>
                    </label>
                  </div>

                  <div className="controls" style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {unmatchedData && (
                        <>
                          <span style={{ padding: "8px 15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                            Total: <b>{unmatchedData.totalProductDetails}</b>
                          </span>
                          <span style={{ padding: "8px 15px", backgroundColor: "#d4edda", borderRadius: "4px", color: "#155724" }}>
                            Matched: <b>{unmatchedData.matched}</b>
                          </span>
                          <span style={{ padding: "8px 15px", backgroundColor: "#f8d7da", borderRadius: "4px", color: "#721c24" }}>
                            Unmatched: <b>{unmatchedData.unmatched}</b>
                          </span>
                          <span style={{ padding: "8px 15px", backgroundColor: "#fff3cd", borderRadius: "4px", color: "#856404" }}>
                            Filtered: <b>{filteredUnmatched.length}</b>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="table-wrapper table-h-scroll table-resize item-list-table-wrapper mt-3" ref={tableRef}>
                {/* Item List Table */}
                {activeTab === "itemlist" && (
                  <>
                    {loading ? (
                      <div className="loading">Loading...</div>
                    ) : rows.length === 0 ? (
                      <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>📄 No Data</div>
                    ) : (
                      <table className="table table-receive table-custom table-compact">
                        <colgroup>
                          <col className="col-item-spec" />
                          <col className="col-item-dia" />
                          <col className="col-item-length" />
                          <col className="col-item-size" />
                          <col className="col-item-l" />
                          <col className="col-item-w" />
                          <col className="col-item-h" />
                          <col className="col-item-sub" />
                          <col className="col-item-weight" />
                          <col className="col-item-vendor" />
                          <col className="col-item-zone" />
                        </colgroup>
                        <thead className="text-center">
                          <tr>
                            <th>Spec</th>
                            <th>Dia</th>
                            <th>Length</th>
                            <th>Size</th>
                            <th>L</th>
                            <th>W</th>
                            <th>H</th>
                            <th>Sub Location</th>
                            <th>Weight</th>
                            <th>Vendor</th>
                            <th>Zone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, idx) => (
                            <tr key={row.itemListId || idx}>
                              <td className="col-item-spec">{row.spec}</td>
                              <td className="col-item-dia">{row.dia}</td>
                              <td className="col-item-length">{row.length}</td>
                              <td className="col-item-size">{row.size}</td>
                              <td className="col-item-l">{row.l}</td>
                              <td className="col-item-w">{row.w}</td>
                              <td className="col-item-h">{row.h}</td>
                              <td className="col-item-sub">{row.subLocation}</td>
                              <td className="col-item-weight">{row.weight}</td>
                              <td className="col-item-vendor">{row.vendor?.vendorMasterName || "-"}</td>
                              <td className="col-item-zone">{row.zone || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {/* Unmatched Products Table */}
                {activeTab === "unmatched" && (
                  <>
                    {loadingUnmatched ? (
                      <div className="loading">Loading...</div>
                    ) : !unmatchedData || filteredUnmatched.length === 0 ? (
                      <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                        {unmatchedData ? (filteredUnmatched.length === 0 ? "🔍 No results found" : "🎉 All products are matched!") : "📄 No Data"}
                      </div>
                    ) : (
                      <table className="table table-receive table-custom table-compact">
                        <colgroup>
                          <col className="col-unmatched-id" />
                          <col className="col-unmatched-box" />
                          <col className="col-unmatched-invoice" />
                          <col className="col-unmatched-case" />
                          <col className="col-unmatched-po" />
                          <col className="col-unmatched-lot" />
                          <col className="col-unmatched-name" />
                          <col className="col-unmatched-spec" />
                          <col className="col-unmatched-size" />
                          <col className="col-unmatched-width" />
                          <col className="col-unmatched-qty" />
                          <col className="col-unmatched-unit" />
                        </colgroup>
                        <thead className="text-center">
                          <tr>
                            <th>ID</th>
                            <th>Box No</th>
                            <th>Master Invoice</th>
                            <th>Case No</th>
                            <th>PO No</th>
                            <th>Lot No</th>
                            <th>Item Name</th>
                            <th>Spec</th>
                            <th>Size</th>
                            <th>Width</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUnmatched.map((product, idx) => (
                            <tr key={product.productDetailsId || idx} style={{ backgroundColor: "#fff3cd" }}>
                              <td className="text-center">{product.productDetailsId}</td>
                              <td>{product.boxNo}</td>
                              <td>{product.masterInvoiceNo}</td>
                              <td>{product.caseNo}</td>
                              <td>{product.poNo}</td>
                              <td>{product.lotNo}</td>
                              <td>{product.itemName}</td>
                              <td>{product.spec}</td>
                              <td>{product.size}</td>
                              <td className="text-right">{product.width}</td>
                              <td className="text-right">{product.quantity}</td>
                              <td>{product.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>

              {/* Footer / Pagination */}
              {activeTab === "itemlist" && (
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
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

