import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import { key } from "../../../constance/constance";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Billing.css";

export default function Billing() {
  // ---------- Date Helper Functions ----------
  const ymdToDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  
  const dateToYMD = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayYMD = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const [billingData, setBillingData] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  
  // Filter states - default to today's date
  const [selectedVendor, setSelectedVendor] = useState("");
  const [billingDateFrom, setBillingDateFrom] = useState(getTodayYMD());
  const [billingDateTo, setBillingDateTo] = useState(getTodayYMD());

  const tableRef = useRef(null);

  useEffect(() => {
    getBillingData();
  }, [selectedVendor, billingDateFrom, billingDateTo, page, limit]);

  useEffect(() => {
    getAllVendors();
  }, []);

  // ---------- Add column resize functionality ----------
  useEffect(() => {
    const addResizeHandles = () => {
      const tables = document.querySelectorAll('.billing-table-wrapper table.table-custom');
      
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
  }, [billingData]);

  const getAllVendors = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', 1);
      params.append('limit', 1000);
      
      const response = await httpClient.get(
        `/api/v1/card/summary_stock_card_report?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem(key.TOKEN)}` },
        }
      );

      if (response.status === 200) {
        const result = response.data.result;
        const reports = result.data || [];
        const vendorNames = reports
          .map(report => report.vendorName)
          .filter(Boolean)
          .map(name => String(name));
        const uniqueVendors = [...new Set(vendorNames)]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setAllVendors(uniqueVendors);
      }
    } catch (error) {
      console.log("Error getting vendors", error);
      setAllVendors([]);
    }
  };

  const getBillingData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      
      if (selectedVendor) params.append('vendorName', selectedVendor);
      if (billingDateFrom) params.append('stockInDateFrom', billingDateFrom);
      if (billingDateTo) params.append('stockOutDateTo', billingDateTo);
      params.append('page', page);
      params.append('limit', limit);

      const response = await httpClient.get(
        `/api/v1/billing/calculate?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem(key.TOKEN)}` },
        }
      );

      if (response.status === 200) {
        const result = response.data.result;
        setBillingData(result.data || []);
        if (typeof result.totalPages === 'number') setTotalPages(result.totalPages);
        if (typeof result.totalCount === 'number') setTotalCount(result.totalCount);
        if (typeof result.currentPage === 'number') setPage(result.currentPage);

        const billingVendorNames = (result.data || [])
          .map(item => item.vendorName)
          .filter(Boolean)
          .map(name => String(name));
        if (billingVendorNames.length) {
          setAllVendors(prev => {
            const next = new Set(prev);
            billingVendorNames.forEach(name => next.add(name));
            return [...next].sort((a, b) => a.localeCompare(b));
          });
        }
      } else if (response.status === 500) {
        Swal.fire({
          title: "Info!",
          text: response.data.result,
          icon: "info",
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (error) {
      console.log("Error", error);
      setBillingData([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedVendor("");
    setBillingDateFrom("");
    setBillingDateTo("");
    setPage(1);
  };

  const exportToCSV = async () => {
    if (exporting) {
      return;
    }

    if (!totalCount) {
      Swal.fire({ icon: "info", title: "No Data", text: "No billing rows to export." });
      return;
    }

    try {
      setExporting(true);

      const headers = [
        'VENDOR CODE',
        'VENDOR NAME',
        'MASTER INVOICE NO.',
        'TOTAL G/W (TON)',
        'DELIVERY TO',
        'STOCK IN DATE',
        'STOCK OUT DATE',
        'STORAGE PERIOD',
        'STORAGE CHARGE',
        'STOCK IN FEE',
        'STOCK OUT FEE',
        'SPECIAL HANDLING FOR BPI FACTORY'
      ];

      const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      const batchSize = Math.max(limit, 200);
      const allRows = [];
      let pageCursor = 1;
      let totalExpected = 0;
      let totalPagesHint = null;
      const maxPages = 500;

      while (true) {
        const params = new URLSearchParams();
        if (selectedVendor) params.append('vendorName', selectedVendor);
        if (billingDateFrom) params.append('stockInDateFrom', billingDateFrom);
        if (billingDateTo) params.append('stockOutDateTo', billingDateTo);
        params.append('page', pageCursor);
        params.append('limit', batchSize);

        const response = await httpClient.get(
          `/api/v1/billing/calculate?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem(key.TOKEN)}` },
          }
        );

        const result = response?.data?.result ?? {};
        const pageRows = Array.isArray(result.data) ? result.data : [];

        if (pageCursor === 1) {
          totalExpected = Number(result.totalCount) || pageRows.length;
          totalPagesHint = Number.isFinite(result.totalPages) ? Number(result.totalPages) : null;
        }

        if (pageRows.length > 0) {
          allRows.push(...pageRows);
        }

        const reachedTotal = totalExpected > 0 && allRows.length >= totalExpected;
        const noMoreData = pageRows.length < batchSize;
        const reachedPageLimit = totalPagesHint ? pageCursor >= totalPagesHint : false;
        const reachedCap = pageCursor >= maxPages;

        if (reachedTotal || noMoreData || reachedPageLimit || reachedCap) {
          break;
        }

        pageCursor += 1;
      }

      const exportRows = allRows.length > 0 ? allRows : billingData;
      if (!exportRows.length) {
        Swal.fire({ icon: "info", title: "No Data", text: "No billing rows to export." });
        return;
      }

      const csvRows = [headers.join(',')];

      exportRows.forEach(item => {
        const row = [
          escapeCsvValue(item.vendor),
          escapeCsvValue(item.vendorName),
          escapeCsvValue(item.masterLot),
          escapeCsvValue(item.grossWeightTon),
          escapeCsvValue(item.deliveryTo),
          escapeCsvValue(item.stockInDate),
          escapeCsvValue(item.stockOutDate),
          escapeCsvValue(item.storageDays ?? item.storagePeriod),
          escapeCsvValue(item.storageFee ?? item.storageCharge),
          escapeCsvValue(item.handlingInFee ?? item.stockInFee),
          escapeCsvValue(item.handlingOutFee ?? item.stockOutFee),
          escapeCsvValue(item.specialHandlingFee ?? item.specialHandling)
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `billing_data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.log("Export error", error);
      Swal.fire({ icon: "error", title: "Export failed", text: error?.message || "Unable to export CSV." });
    } finally {
      setExporting(false);
    }
  };

  const renderTableHeader = () => (
    <tr>
      <th className="col-billing-vendor">VENDOR CODE</th>
      <th className="col-billing-vendorName">VENDOR NAME</th>
      <th className="col-billing-masterLot">MASTER INVOICE NO.</th>
      <th className="col-billing-grossWeight">TOTAL G/W (TON)</th>
      <th className="col-billing-deliveryTo">DELIVERY TO</th>
      <th className="col-billing-stockInDate">STOCK IN DATE</th>
      <th className="col-billing-stockOutDate">STOCK OUT DATE</th>
      <th className="col-billing-storagePeriod">STORAGE PERIOD</th>
      <th className="col-billing-storageCharge">STORAGE CHARGE</th>
      <th className="col-billing-stockInFee">STOCK IN FEE</th>
      <th className="col-billing-stockOutFee">STOCK OUT FEE</th>
      <th className="col-billing-specialHandling">SPECIAL HANDLING FOR BPI FACTORY</th>
    </tr>
  );

  const renderTableBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={12} className="text-center">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </td>
        </tr>
      );
    }

    return billingData.map((item, index) => (
      <tr key={item.invoiceNo || index}>
        <td className="col-billing-vendor">{item.vendor || '-'}</td>
        <td className="col-billing-vendorName">{item.vendorName || '-'}</td>
        <td className="col-billing-masterLot">{item.masterLot || '-'}</td>
        <td className="col-billing-grossWeight">{item.grossWeightTon ? Number(item.grossWeightTon).toLocaleString() : '-'}</td>
        <td className="col-billing-deliveryTo">{item.deliveryTo || '-'}</td>
        <td className="col-billing-stockInDate">{formatDateToDDMMYYYY(item.stockInDate)}</td>
        <td className="col-billing-stockOutDate">{formatDateToDDMMYYYY(item.stockOutDate)}</td>
        <td className="col-billing-storagePeriod">{item.storageDays || '-'}</td>
        <td className="col-billing-storageCharge">{item.storageFee ? Number(item.storageFee).toLocaleString() : '-'}</td>
        <td className="col-billing-stockInFee">{item.handlingInFee ? Number(item.handlingInFee).toLocaleString() : '-'}</td>
        <td className="col-billing-stockOutFee">{item.handlingOutFee ? Number(item.handlingOutFee).toLocaleString() : '-'}</td>
        <td className="col-billing-specialHandling">{item.specialHandlingFee ? Number(item.specialHandlingFee).toLocaleString() : '-'}</td>
      </tr>
    ));
  };

  return (
    <>
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">REPORT</li>
                <li className="breadcrumb-item">
                  <Link to="/vmi-report-menu" className="color-link">Logistics Report</Link>
                </li>
                <li className="breadcrumb-item active">
                  <span className="color-link">BILLING</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col">
            <div className="card angle gap-margin">
              <div className="card-header card-receive">BILLING</div>

              <div className="card-body gap-margin">
                 {/* Filters */}
                 <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                   <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <span className="vp-label" style={{ minWidth: 80 }}>Vendor</span>
                     <select
                       className="form-control angle"
                       value={selectedVendor}
                      onChange={(e) => {
                        setSelectedVendor(e.target.value);
                        setPage(1);
                      }}
                       style={{ minWidth: 200 }}
                     >
                       <option value="">All Vendors</option>
                       {allVendors.map((vendor, index) => (
                         <option key={index} value={vendor}>
                           {vendor}
                         </option>
                       ))}
                     </select>
                   </label>

                   <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <span className="vp-label" style={{ minWidth: 120 }}>Stock In Date From</span>
                     <DatePicker
                       selected={ymdToDate(billingDateFrom)}
                       onChange={(d) => setBillingDateFrom(dateToYMD(d))}
                       dateFormat="dd/MM/yyyy"
                       placeholderText="dd/mm/yyyy"
                       className="form-control angle"
                       showMonthDropdown
                       showYearDropdown
                       dropdownMode="select"
                       portalId="root"
                       popperClassName="billing-popper"
                     />
                   </label>

                   <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                     <span className="vp-label" style={{ minWidth: 120 }}>Stock Out Date To</span>
                     <DatePicker
                       selected={ymdToDate(billingDateTo)}
                       onChange={(d) => setBillingDateTo(dateToYMD(d))}
                       dateFormat="dd/MM/yyyy"
                       placeholderText="dd/mm/yyyy"
                       className="form-control angle"
                       showMonthDropdown
                       showYearDropdown
                       dropdownMode="select"
                       portalId="root"
                       popperClassName="billing-popper"
                     />
                   </label>

                   <span style={{ flexBasis: "100%", height: 0 }} />

                  {/* Clear Button - Left */}
                  <button 
                    className="btn btn-secondary angle" 
                    onClick={clearFilters}
                  >
                    Clear
                  </button>

                  {/* Action Buttons - Right */}
                  <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
                     <button 
                       className="btn btn-success angle" 
                       onClick={exportToCSV}
                       disabled={loading || exporting || !totalCount}
                     >
                       {exporting ? "Exporting..." : "Export CSV"}
                     </button>
                   </div>
                 </div>

                {/* Table */}
                <div className="table-wrapper table-h-scroll table-resize billing-table-wrapper mt-3" ref={tableRef}>
                  {loading ? (
                    <div className="loading">Loading...</div>
                  ) : !Array.isArray(billingData) || billingData.length === 0 ? (
                    <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                      📄 No Data
                    </div>
                  ) : (
                    <table className="table table-custom table-compact table-wide billing-table">
                      <colgroup>
                        <col className="col-billing-vendor" />
                        <col className="col-billing-vendorName" />
                        <col className="col-billing-masterLot" />
                        <col className="col-billing-grossWeight" />
                        <col className="col-billing-deliveryTo" />
                        <col className="col-billing-stockInDate" />
                        <col className="col-billing-stockOutDate" />
                        <col className="col-billing-storagePeriod" />
                        <col className="col-billing-storageCharge" />
                        <col className="col-billing-stockInFee" />
                        <col className="col-billing-stockOutFee" />
                        <col className="col-billing-specialHandling" />
                      </colgroup>
                      <thead className="text-center">{renderTableHeader()}</thead>
                      <tbody>{renderTableBody()}</tbody>
                    </table>
                  )}
                </div>

                {/* Pagination Controls */}
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontStyle: 'italic' }}>
                    Total rows: {Number(totalCount || 0).toLocaleString()}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button 
                      className="btn btn-light angle" 
                      onClick={() => setPage((p) => Math.max(1, p - 1))} 
                      disabled={page <= 1 || loading}
                    >
                      ◀ Prev
                    </button>
                    <span>Page <b>{page}</b> / {totalPages.toLocaleString()}</span>
                    <button 
                      className="btn btn-light angle" 
                      onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))} 
                      disabled={page >= totalPages || loading}
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
    </div>
    </>
  );
}
