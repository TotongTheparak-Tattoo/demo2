import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import { key } from "../../../constance/constance";
import Swal from "sweetalert2";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./StockInOut.css";
import html2pdf from "html2pdf.js";

const ENDPOINT = "/api/v1/card/summary_stock_card_report";
const ITEMS_PER_PAGE = 10;


// ============================================================================
// HELPER FUNCTIONS - Date & Formatting
// ============================================================================
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
const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes("\r") ||
    stringValue.includes('"')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export default function StockInOut() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  // Data state
  const [vendorReports, setVendorReports] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Filter state
  const [selectedVendor, setSelectedVendor] = useState("");
  const [stockInStartDate, setStockInStartDate] = useState(getTodayYMD());
  const [stockInEndDate, setStockInEndDate] = useState(getTodayYMD());
  const [stockOutStartDate, setStockOutStartDate] = useState(getTodayYMD());
  const [stockOutEndDate, setStockOutEndDate] = useState(getTodayYMD());
  const [searchTerm, setSearchTerm] = useState("");
  // Print/Export state
  const [printRows, setPrintRows] = useState([]);
  // UI refs
  const tableRef = useRef(null);
  const printRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem(key.TOKEN)}` },
  });
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงรายการ vendors ทั้งหมด*/
  const getAllVendors = async () => {
    try {
      const params = new URLSearchParams();
      params.append("page", 1);
      params.append("limit", 1000); // ดึงจำนวนมากเพื่อให้ได้ vendors ทั้งหมด

      const response = await httpClient.get(`${ENDPOINT}?${params.toString()}`, authHeaders());

      if (response.status === 200) {
        const result = response.data.result;
        const reports = result.data || [];
        const uniqueVendors = [...new Set(reports.map((report) => report.vendorName))].filter(
          Boolean
        );
        setAllVendors(uniqueVendors);
      }
    } catch (error) {
      console.log("Error getting vendors", error);
      setAllVendors([]);
    }
  };
  /*ดึงข้อมูล vendor reports ตามหน้าและ filter*/
  const getVendorReports = async () => {
    try {
      setLoading(true);
      // สร้าง query parameters
      const params = new URLSearchParams();
      params.append("page", currentPage);
      params.append("limit", ITEMS_PER_PAGE);

      if (selectedVendor) params.append("vendorName", selectedVendor);
      if (stockInStartDate) params.append("stockInStartDate", stockInStartDate);
      if (stockInEndDate) params.append("stockInEndDate", stockInEndDate);
      if (stockOutStartDate) params.append("stockOutStartDate", stockOutStartDate);
      if (stockOutEndDate) params.append("stockOutEndDate", stockOutEndDate);
      if (searchTerm) params.append("search", searchTerm);

      const response = await httpClient.get(`${ENDPOINT}?${params.toString()}`, authHeaders());

      if (response.status === 200) {
        const result = response.data.result;
        setVendorReports(result.data || []);
        setTotalCount(result.totalCount || 0);
        setTotalPages(result.totalPages || 0);
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
      setVendorReports([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    getAllVendors();
  }, []);
  useEffect(() => {
    getVendorReports();
  }, [
    currentPage,
    selectedVendor,
    stockInStartDate,
    stockInEndDate,
    stockOutStartDate,
    stockOutEndDate,
    searchTerm,
  ]);
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  /*Clear all filters*/
  const clearFilters = () => {
    setSelectedVendor("");
    setStockInStartDate("");
    setStockInEndDate("");
    setStockOutStartDate("");
    setStockOutEndDate("");
    setCurrentPage(1);
  };
  /*Export ข้อมูลเป็น CSV*/
  const exportToCSV = async () => {
    if (exporting) return;
    if (totalCount === 0) {
      Swal.fire({ icon: "info", title: "No Data", text: "No data to export." });
      return;
    }
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append("page", 1);
      params.append("limit", Math.max(totalCount, ITEMS_PER_PAGE));

      if (selectedVendor) params.append("vendorName", selectedVendor);
      if (stockInStartDate) params.append("stockInStartDate", stockInStartDate);
      if (stockInEndDate) params.append("stockInEndDate", stockInEndDate);
      if (stockOutStartDate) params.append("stockOutStartDate", stockOutStartDate);
      if (stockOutEndDate) params.append("stockOutEndDate", stockOutEndDate);
      if (searchTerm) params.append("search", searchTerm);

      const response = await httpClient.get(`${ENDPOINT}?${params.toString()}`, authHeaders());

      if (response.status === 200) {
        const result = response.data.result;
        const allReports = result.data || [];
        // กำหนด headers สำหรับ CSV
        const headers = [
          "VENDOR",
          "VENDOR NAME",
          "INVOICE NO.",
          "CASE NO.",
          "PALLET ID",
          "P/O NO.",
          "LOT NO.",
          "HEAT NO.",
          "DESCRIPTION",
          "SPEC",
          "SIZE",
          "CURRENCY",
          "UNIT PRICE",
          "AMOUNT",
          "Q'TY (PCS)",
          "NET WEIGHT",
          "GROSS WEIGHT",
          "STOCK IN DATE",
          "MASTER LOT IMPORT ENTRY",
          "STOCK OUT DATE",
          "DELIVERY TO",
          "PARTIAL LOT INVOICE NO.",
          "PARTIAL LOT EXPORT ENTRY NO.",
        ];
        const csvRows = [headers.join(",")];
        // สร้าง CSV rows
        allReports.forEach((report) => {
          const row = [
            escapeCsvValue(report.vendor),
            escapeCsvValue(report.vendorName),
            escapeCsvValue(report.invoiceNo),
            escapeCsvValue(report.caseNo),
            escapeCsvValue(report.boxNo),
            escapeCsvValue(report.poNo),
            escapeCsvValue(report.lotNo),
            escapeCsvValue(report.heatNo),
            escapeCsvValue(report.description),
            escapeCsvValue(report.spec),
            escapeCsvValue(report.size),
            escapeCsvValue(report.currency),
            escapeCsvValue(report.unitPrice),
            escapeCsvValue(report.amount),
            escapeCsvValue(report.quantity),
            escapeCsvValue(report.netWeight),
            escapeCsvValue(report.grossWeight),
            escapeCsvValue(report.stockInDate),
            escapeCsvValue(report.masterLotImportEntry),
            escapeCsvValue(report.stockOutDate),
            escapeCsvValue(report.deliveryTo),
            escapeCsvValue(report.partialLotInvoiceNo),
            escapeCsvValue(report.partialLotExportEntryNo),
          ];
          csvRows.push(row.join(","));
        });

        const csvContent = csvRows.join("\n");

        // สร้างไฟล์และดาวน์โหลด
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `stock_in_out_data_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.log("Export error", error);
      Swal.fire({
        icon: "error",
        title: "Export failed",
        text: error?.message || "Unable to export CSV.",
      });
    } finally {
      setExporting(false);
    }
  };

  /*Download PDF*/
  const downloadPdf = async () => {
    const data = Array.isArray(vendorReports) ? vendorReports : [];
    if (!data.length) {
      Swal.fire({ icon: "info", title: "Nothing to export", text: "No rows on this page." });
      return;
    }
    setPrintRows(data); // ตั้งค่า data สำหรับ print
    await new Promise((r) => requestAnimationFrame(r)); // รอจนกว่าจะทำงานเสร็จ
    const el = printRef.current;
    if (!el) {
      Swal.fire({ icon: "error", title: "ไม่พบเนื้อหาที่จะทำ PDF" });
      return;
    }
    // เก็บ style เดิม
    const prev = {
      visibility: el.style.visibility,
      position: el.style.position,
      left: el.style.left,
    };
    // ตั้งค่า style สำหรับ print
    el.style.visibility = "visible";
    el.style.position = "static";
    el.style.left = "auto";

    try {
      const opt = {
        margin: [5, 5, 5, 5],
        filename: `stock_in_out_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"], avoid: "tr" },
      };
      await html2pdf().set(opt).from(el).save();
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Export PDF ล้มเหลว",
        text: e?.message || "ไม่ทราบสาเหตุ",
      });
    } finally {
      // คืนค่า style เดิม
      el.style.visibility = prev.visibility;
      el.style.position = prev.position;
      el.style.left = prev.left;
    }
  };
  // ============================================================================
  // PAGINATION HANDLERS
  // ============================================================================
  /*Go to specific page*/
  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
    }
  };
  /*Go to previous page*/
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  /*Go to next page*/
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  /*Render table header*/
  const renderTableHeader = () => (
    <tr>
      <th>VENDOR</th>
      <th>VENDOR NAME</th>
      <th>INVOICE NO.</th>
      <th>CASE NO.</th>
      <th>PALLET ID</th>
      <th>P/O NO.</th>
      <th>LOT NO.</th>
      <th>HEAT NO.</th>
      <th>DESCRIPTION</th>
      <th>SPEC</th>
      <th>SIZE</th>
      <th>CURRENCY</th>
      <th>UNIT PRICE</th>
      <th>AMOUNT</th>
      <th>Q'TY (PCS)</th>
      <th>NET WEIGHT</th>
      <th>GROSS WEIGHT</th>
      <th>STOCK IN DATE</th>
      <th>MASTER LOT IMPORT ENTRY</th>
      <th>STOCK OUT DATE</th>
      <th>DELIVERY TO</th>
      <th>PARTIAL LOT INVOICE NO.</th>
      <th>PARTIAL LOT EXPORT ENTRY NO.</th>
    </tr>
  );
  /*Render table body*/
  const renderTableBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={23} className="text-center">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </td>
        </tr>
      );
    }
    return vendorReports.map((report, index) => (
      <tr key={report.vendorReportId || index}>
        <td className="text-center">{report.vendor || "-"}</td>
        <td className="text-center">{report.vendorName || "-"}</td>
        <td className="text-center">{report.invoiceNo || "-"}</td>
        <td className="text-center">{report.caseNo || "-"}</td>
        <td className="text-center">{report.boxNo || "-"}</td>
        <td className="text-center">{report.poNo || "-"}</td>
        <td className="text-center">{report.lotNo || "-"}</td>
        <td className="text-center">{report.heatNo || "-"}</td>
        <td className="text-center">{report.description || "-"}</td>
        <td className="text-center">{report.spec || "-"}</td>
        <td className="text-center">{report.size || "-"}</td>
        <td className="text-center">{report.currency || "-"}</td>
        <td className="text-center">
          {report.unitPrice ? Number(report.unitPrice).toLocaleString() : "-"}
        </td>
        <td className="text-center">
          {report.amount ? Number(report.amount).toLocaleString() : "-"}
        </td>
        <td className="text-center">
          {report.quantity ? Number(report.quantity).toLocaleString() : "-"}
        </td>
        <td className="text-center">
          {report.netWeight ? Number(report.netWeight).toLocaleString() : "-"}
        </td>
        <td className="text-center">
          {report.grossWeight ? Number(report.grossWeight).toLocaleString() : "-"}
        </td>
        <td className="text-center">{report.stockInDate || "-"}</td>
        <td className="text-center">{report.masterLotImportEntry || "-"}</td>
        <td className="text-center">{report.stockOutDate || "-"}</td>
        <td className="text-center">{report.deliveryTo || "-"}</td>
        <td className="text-center">{report.partialLotInvoiceNo || "-"}</td>
        <td className="text-center">{report.partialLotExportEntryNo || "-"}</td>
      </tr>
    ));
  };
  /*Render pagination controls*/
  const renderPagination = () => {
    const displayCurrentPage = currentPage || 1;
    const displayTotalPages = totalPages || 1;
    const displayTotalCount = totalCount || 0;
    const canPrev = displayCurrentPage > 1;
    const canNext = displayCurrentPage < displayTotalPages;
    return (
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontStyle: "italic" }}>Total rows: {displayTotalCount.toLocaleString()}</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn btn-light angle"
            onClick={goToPreviousPage}
            disabled={!canPrev || loading}
          >
            ◀ Prev
          </button>

          <span>
            Page <b>{displayCurrentPage}</b> / {displayTotalPages.toLocaleString()}
          </span>

          <button
            className="btn btn-light angle"
            onClick={goToNextPage}
            disabled={!canNext || loading}
          >
            Next ▶
          </button>
        </div>
      </div>
    );
  };
  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <>
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
                  <li className="breadcrumb-item active">
                    <span className="color-link">STOCK IN - OUT DATA</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="row">
            <div className="col">
              <div className="card angle gap-margin">
                <div className="card-header card-receive">STOCK IN - OUT DATA</div>

                <div className="card-body gap-margin">
                  {/* Filter Controls */}
                  <div
                    className="controls"
                    style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
                  >
                    {/* Vendor Filter */}
                    <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="vp-label" style={{ minWidth: 80 }}>
                        Vendor
                      </span>
                      <select
                        className="form-control angle"
                        value={selectedVendor}
                        onChange={(e) => setSelectedVendor(e.target.value)}
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

                    <span style={{ flexBasis: "100%", height: 0 }} />

                    {/* Stock In Date Range */}
                    <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="vp-label" style={{ minWidth: 120 }}>
                        Stock In From
                      </span>
                      <DatePicker
                        selected={ymdToDate(stockInStartDate)}
                        onChange={(d) => setStockInStartDate(dateToYMD(d))}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="dd/mm/yyyy"
                        className="form-control angle"
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        portalId="root"
                        popperClassName="stockinout-popper"
                      />
                    </label>

                    <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="vp-label" style={{ minWidth: 20 }}>to</span>
                      <DatePicker
                        selected={ymdToDate(stockInEndDate)}
                        onChange={(d) => setStockInEndDate(dateToYMD(d))}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="dd/mm/yyyy"
                        className="form-control angle"
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        portalId="root"
                        popperClassName="stockinout-popper"
                      />
                    </label>

                    <span style={{ flexBasis: "100%", height: 0 }} />

                    {/* Stock Out Date Range */}
                    <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="vp-label" style={{ minWidth: 120 }}>
                        Stock Out From
                      </span>
                      <DatePicker
                        selected={ymdToDate(stockOutStartDate)}
                        onChange={(d) => setStockOutStartDate(dateToYMD(d))}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="dd/mm/yyyy"
                        className="form-control angle"
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        portalId="root"
                        popperClassName="stockinout-popper"
                      />
                    </label>

                    <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="vp-label" style={{ minWidth: 20 }}>to</span>
                      <DatePicker
                        selected={ymdToDate(stockOutEndDate)}
                        onChange={(d) => setStockOutEndDate(dateToYMD(d))}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="dd/mm/yyyy"
                        className="form-control angle"
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        portalId="root"
                        popperClassName="stockinout-popper"
                      />
                    </label>

                    <span style={{ flexBasis: "100%", height: 0 }} />

                    {/* Clear Button */}
                    <button className="btn btn-secondary angle" onClick={clearFilters}>
                      Clear
                    </button>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
                      <button
                        className="btn btn-success angle"
                        onClick={exportToCSV}
                        disabled={loading || exporting || totalCount === 0}
                      >
                        {exporting ? "Exporting..." : "Export CSV"}
                      </button>
                      <button
                        className="btn btn-danger angle"
                        onClick={downloadPdf}
                        disabled={loading || !vendorReports.length}
                        title="Save PDF"
                      >
                        Save PDF
                      </button>
                    </div>
                  </div>

                  {/* Data Table */}
                  <div className="table-wrapper table-h-scroll mt-3" ref={tableRef}>
                    {loading ? (
                      <div className="loading">Loading...</div>
                    ) : !Array.isArray(vendorReports) || vendorReports.length === 0 ? (
                      <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                        📄 No Data
                      </div>
                    ) : (
                      <table className="table table-custom table-compact table-wide">
                        <thead className="text-center">{renderTableHeader()}</thead>
                        <tbody>{renderTableBody()}</tbody>
                      </table>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {renderPagination()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden printable portal for PDF */}
      <div
        className="print-portal"
        style={{ position: "absolute", left: -99999, top: 0, visibility: "hidden" }}
      >
        <div ref={printRef} style={{ background: "#fff", color: "#000" }}>
          <div style={{ textAlign: "center", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
            STOCK IN - OUT DATA
          </div>
          <table className="pdf-grid">
            <thead>
              <tr>
                <th>VENDOR</th>
                <th>VENDOR NAME</th>
                <th>INVOICE NO.</th>
                <th>CASE NO.</th>
                <th>PALLET ID</th>
                <th>P/O NO.</th>
                <th>LOT NO.</th>
                <th>HEAT NO.</th>
                <th>DESCRIPTION</th>
                <th>SPEC</th>
                <th>SIZE</th>
                <th>CURRENCY</th>
                <th>UNIT PRICE</th>
                <th>AMOUNT</th>
                <th>Q'TY (PCS)</th>
                <th>NET WEIGHT</th>
                <th>GROSS WEIGHT</th>
                <th>STOCK IN DATE</th>
                <th>MASTER LOT IMPORT ENTRY</th>
                <th>STOCK OUT DATE</th>
                <th>DELIVERY TO</th>
                <th>PARTIAL LOT INVOICE NO.</th>
                <th>PARTIAL LOT EXPORT ENTRY NO.</th>
              </tr>
            </thead>
            <tbody>
              {(printRows.length ? printRows : vendorReports).map((report, idx) => (
                <tr key={report.vendorReportId || idx}>
                  <td>{report.vendor || ""}</td>
                  <td>{report.vendorName || ""}</td>
                  <td>{report.invoiceNo || ""}</td>
                  <td>{report.caseNo || ""}</td>
                  <td>{report.boxNo || ""}</td>
                  <td>{report.poNo || ""}</td>
                  <td>{report.lotNo || ""}</td>
                  <td>{report.heatNo || ""}</td>
                  <td>{report.description || ""}</td>
                  <td>{report.spec || ""}</td>
                  <td>{report.size || ""}</td>
                  <td>{report.currency || ""}</td>
                  <td>{report.unitPrice ?? ""}</td>
                  <td>{report.amount ?? ""}</td>
                  <td>{report.quantity ?? ""}</td>
                  <td>{report.netWeight ?? ""}</td>
                  <td>{report.grossWeight ?? ""}</td>
                  <td>{report.stockInDate || ""}</td>
                  <td>{report.masterLotImportEntry || ""}</td>
                  <td>{report.stockOutDate || ""}</td>
                  <td>{report.deliveryTo || ""}</td>
                  <td>{report.partialLotInvoiceNo || ""}</td>
                  <td>{report.partialLotExportEntryNo || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
