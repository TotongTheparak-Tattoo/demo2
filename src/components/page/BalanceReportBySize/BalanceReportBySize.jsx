import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import { key } from "../../../constance/constance";
import Swal from "sweetalert2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from 'xlsx';
import "./BalanceReportBySize.css";

export default function BalanceReportBySize() {
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

  const getTodayYMD = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Calculate days between two dates
  const calculateDays = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    const diffTime = today - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get aging category
  const getAgingCategory = (days) => {
    if (days === null || days === undefined) return null;
    if (days >= 0 && days <= 29) return "CURRENT";
    if (days >= 30 && days <= 59) return "30DAY";
    if (days >= 60 && days <= 89) return "60DAY";
    if (days >= 90 && days <= 119) return "90DAY";
    if (days >= 120 && days <= 149) return "120DAY";
    if (days >= 150) return "OVER150";
    return null;
  };

  const [rows, setRows] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]); // Store all transaction details
  const [allVendors, setAllVendors] = useState([]);
  const [allSizes, setAllSizes] = useState([]);
  const [vendorSizeMap, setVendorSizeMap] = useState({}); // Map vendor to sizes
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Filter states
  const [selectedVendor, setSelectedVendor] = useState("");
  const [dateTo, setDateTo] = useState(getTodayYMD());

  const tableRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [selectedVendor, dateTo]);

  useEffect(() => {
    fetchVendorsAndSizes();
  }, []);

  const fetchVendorsAndSizes = async () => {
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
        
        // Extract unique vendors
        const vendorNames = reports
          .map(report => report.vendorName)
          .filter(Boolean)
          .map(name => String(name));
        const uniqueVendors = [...new Set(vendorNames)]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setAllVendors(uniqueVendors);
        
        // Build vendor to size mapping
        const vendorSizeMapping = {};
        const allSizesSet = new Set();
        
        reports.forEach(report => {
          const vendor = report.vendorName;
          const size = report.partNo || report.size || report.partNumber;
          
          if (vendor && size) {
            if (!vendorSizeMapping[vendor]) {
              vendorSizeMapping[vendor] = new Set();
            }
            vendorSizeMapping[vendor].add(String(size));
            allSizesSet.add(String(size));
          }
        });
        
        // Convert Sets to sorted arrays
        const vendorSizeMapFormatted = {};
        Object.keys(vendorSizeMapping).forEach(vendor => {
          vendorSizeMapFormatted[vendor] = Array.from(vendorSizeMapping[vendor])
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        });
        
        setVendorSizeMap(vendorSizeMapFormatted);
        
        // Extract unique sizes (all sizes)
        const uniqueSizes = Array.from(allSizesSet)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setAllSizes(uniqueSizes);
      }
    } catch (error) {
      console.log("Error getting vendors and sizes", error);
      setAllVendors([]);
      setAllSizes([]);
      setVendorSizeMap({});
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      
      if (selectedVendor) params.append('vendorName', selectedVendor);
      // Get data from past to dateTo (no start date, only end date)
      if (dateTo) params.append('stockInEndDate', dateTo);
      params.append('page', 1);
      params.append('limit', 10000); // Get all data for calculation

      const response = await httpClient.get(
        `/api/v1/card/summary_stock_card_report?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem(key.TOKEN)}` },
        }
      );

      if (response.status === 200) {
        const result = response.data.result;
        const reports = result.data || [];
        
        // Group by size (partNo)
        const groupedBySize = {};
        
        reports.forEach(report => {
          const size = report.partNo || report.size || report.partNumber || "UNKNOWN";
          
          if (!groupedBySize[size]) {
            groupedBySize[size] = {
              partNo: size,
              stockInQty: 0,
              stockOutQty: 0,
              items: []
            };
          }
          
          // Calculate stock in qty (receives) - use productNetWeight
          const stockInQty = Number(report.productNetWeight || 0);
          if (stockInQty > 0) {
            groupedBySize[size].stockInQty += stockInQty;
          }
          
          // Calculate stock out qty (picking) - use mrNetWeight
          const stockOutQty = Number(report.mrNetWeight || 0);
          groupedBySize[size].stockOutQty += stockOutQty;
          
          // Store item for aging calculation (only if stock in qty > 0)
          if (stockInQty > 0 && (report.stockInDate || report.receivedDate)) {
            groupedBySize[size].items.push({
              qty: stockInQty - stockOutQty,
              stockInDate: report.stockInDate || report.receivedDate
            });
          }
        });
        
        // Calculate balance and aging for each size
        const processedRows = Object.values(groupedBySize).map(sizeData => {
          const balanceQty = sizeData.stockInQty - sizeData.stockOutQty;
          
          // Calculate aging buckets
          const aging = {
            CURRENT: 0,    // 0-29 days
            "30DAY": 0,   // 30-59 days
            "60DAY": 0,   // 60-89 days
            "90DAY": 0,   // 90-119 days
            "120DAY": 0,  // 120-149 days
            "OVER150": 0  // 150+ days
          };
          
          sizeData.items.forEach(item => {
            if (item.qty > 0 && item.stockInDate) {
              const days = calculateDays(item.stockInDate);
              const category = getAgingCategory(days);
              if (category) {
                aging[category] += item.qty;
              }
            }
          });
          
          return {
            partNo: sizeData.partNo,
            stockInQty: sizeData.stockInQty,
            stockOutQty: sizeData.stockOutQty,
            balanceQty: balanceQty,
            current: aging.CURRENT,
            day30: aging["30DAY"],
            day60: aging["60DAY"],
            day90: aging["90DAY"],
            day120: aging["120DAY"],
            over150: aging["OVER150"]
          };
        });
        
        // Sort by partNo
        processedRows.sort((a, b) => a.partNo.localeCompare(b.partNo));
        
        // Store all transactions for detailed export
        const transactionDetails = reports.map(report => ({
          size: report.size || "UNKNOWN",
          date: report.stockInDate || "",
          customsRef: report.invoiceNo || "",
          lot: report.lotNo || "",
          batch: report.heatNo || "",
          stockInQty: Number(report.productNetWeight || 0),
          customerRef: report.partialLotInvoiceNo || "",
          customerName: report.deliveryTo || "",
          stockOutQty: Number(report.mrNetWeight || 0),
          description: report.description || ""
        })).filter(t => t.stockInQty > 0 || t.stockOutQty > 0);
        
        setAllTransactions(transactionDetails);
        setRows(processedRows);
      }
    } catch (error) {
      console.error("Error fetching data", error);
      setRows([]);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: error?.response?.data?.message || error?.message || "Could not load data.",
        confirmButtonText: "OK",
      });
    } finally {
      setLoading(false);
    }
  };

  const onClear = () => {
    setSelectedVendor("");
    setDateTo(getTodayYMD());
  };

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return dateString;
    }
  };

  const exportToExcel = async () => {
    if (exporting || rows.length === 0) return;
    
    try {
      setExporting(true);
      // ถ้า vendor เป็น NMB-Minebea Thai Ltd ให้ใส่ clientName เป็น Keiaisha Co.,ltd
      let clientName;
      if (selectedVendor === "NMB-Minebea Thai Ltd") {
        clientName = "Keiaisha Co.,ltd";
      } else {
        clientName = selectedVendor ? `${selectedVendor}` : "ALL VENDORS";
      }
      // Get client name and vendor name from filters
      const vendorName = selectedVendor || "";
      const reportDate = formatDateToDDMMYYYY(dateTo || getTodayYMD());
      
      // Format number helper
      const formatNumber = (num) => {
        if (num === null || num === undefined) return 0;
        const n = Number(num);
        if (Number.isNaN(n)) return 0;
        return Number.isInteger(n) ? n : Math.round(n * 1000) / 1000;
      };
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create Summary Sheet (first sheet) - original format
      const summaryData = [];
      
      // Header rows for summary
      const summaryHeaderRow1 = ["Client Name:", clientName, "", "", "", "", "", "", "", ""];
      const summaryHeaderRow2 = ["Vendor Name:", "", "", "", "", "", "", "", "", ""];
      const summaryHeaderRow3 = ["REPORT AS OF:", reportDate, "", "", "", "", "", "", "", ""];
      
      summaryData.push(summaryHeaderRow1);
      summaryData.push(summaryHeaderRow2);
      summaryData.push(summaryHeaderRow3);
      
      // Table headers for summary
      const summaryHeaders = [
        "PART NO.",
        "STOCK IN QTY",
        "STOCK OUT QTY",
        "BALANCE QTY",
        "CURRENT", //(0-29)
        "30 DAY", //(30-59)
        "60 DAY", //(60-89)
        "90 DAY", //(90-119)
        "120 DAY", //(120-149)
        "OVER 150" //(150+)
      ];
      summaryData.push(summaryHeaders);
      
      // Add summary rows (from rows state)
      rows.forEach(row => {
        summaryData.push([
          row.partNo,
          formatNumber(row.stockInQty),
          formatNumber(row.stockOutQty),
          formatNumber(row.balanceQty),
          formatNumber(row.current),
          formatNumber(row.day30),
          formatNumber(row.day60),
          formatNumber(row.day90),
          formatNumber(row.day120),
          formatNumber(row.over150)
        ]);
      });
      
      // Calculate summary totals
      const summaryTotals = {
        stockInQty: rows.reduce((sum, row) => sum + (Number(row.stockInQty) || 0), 0),
        stockOutQty: rows.reduce((sum, row) => sum + (Number(row.stockOutQty) || 0), 0),
        balanceQty: rows.reduce((sum, row) => sum + (Number(row.balanceQty) || 0), 0),
        current: rows.reduce((sum, row) => sum + (Number(row.current) || 0), 0),
        day30: rows.reduce((sum, row) => sum + (Number(row.day30) || 0), 0),
        day60: rows.reduce((sum, row) => sum + (Number(row.day60) || 0), 0),
        day90: rows.reduce((sum, row) => sum + (Number(row.day90) || 0), 0),
        day120: rows.reduce((sum, row) => sum + (Number(row.day120) || 0), 0),
        over150: rows.reduce((sum, row) => sum + (Number(row.over150) || 0), 0)
      };
      
      // Add TOTAL row to summary
      summaryData.push([
        "TOTAL",
        formatNumber(summaryTotals.stockInQty),
        formatNumber(summaryTotals.stockOutQty),
        formatNumber(summaryTotals.balanceQty),
        formatNumber(summaryTotals.current),
        formatNumber(summaryTotals.day30),
        formatNumber(summaryTotals.day60),
        formatNumber(summaryTotals.day90),
        formatNumber(summaryTotals.day120),
        formatNumber(summaryTotals.over150)
      ]);
      
      // Create summary worksheet
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths for summary
      summaryWs['!cols'] = [
        { wch: 20 },  // PART NO.
        { wch: 15 },  // STOCK IN QTY
        { wch: 15 },  // STOCK OUT QTY
        { wch: 15 },  // BALANCE QTY
        { wch: 15 },  // CURRENT(0-29)
        { wch: 15 },  // 30 DAY(30-59)
        { wch: 15 },  // 60 DAY(60-89)
        { wch: 15 },  // 90 DAY(90-119)
        { wch: 15 },  // 120 DAY(120-149)
        { wch: 15 }   // OVER 150(150+)
      ];
      
      // Add summary worksheet as first sheet
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      // Group transactions by size
      const transactionsBySize = {};
      allTransactions.forEach(trans => {
        const size = trans.size;
        if (!transactionsBySize[size]) {
          transactionsBySize[size] = [];
        }
        transactionsBySize[size].push(trans);
      });
      
      // Find size description from transaction details
      const sizeDescriptions = {};
      allTransactions.forEach(trans => {
        if (trans.size && trans.description && !sizeDescriptions[trans.size]) {
          sizeDescriptions[trans.size] = trans.description;
        }
      });
      // Fallback to partNo if no description found
      rows.forEach(row => {
        if (!sizeDescriptions[row.partNo]) {
          sizeDescriptions[row.partNo] = row.partNo;
        }
      });
      
      // Create a sheet for each size
      Object.keys(transactionsBySize).sort().forEach(size => {
        const transactions = transactionsBySize[size].sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateA - dateB;
        });
        
        const excelData = [];
        
        // Header rows
        const headerRow1 = ["REPORT AS OF:", reportDate, "", "", "", "", "", "", "", "", "", "", "", "", ""];
        const headerRow2 = ["PART:", size, "", "", "", "", "", "", "", "", "", "", "", "", ""];
        const headerRow3 = ["PART DESCRIPTION:", sizeDescriptions[size] || size, "", "", "", "", "", "", "", "", "", "", "", "", ""];
        
        excelData.push(headerRow1);
        excelData.push(headerRow2);
        excelData.push(headerRow3);
        
        // Row 4: Main headers - STOCK IN, STOCK OUT, BALANCE, BALANCE QTY HISTORY only
        // Column mapping: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14
        const mainHeaders = [
          "", "", "", "", // DATE, Customs Ref., LOT, BATCH - empty in row 4 (A-D)
          "STOCK IN", // On top of QTY only (E)
          "", // Customer Ref. column - empty (F)
          "", // Customer Name column - empty (G)
          "STOCK OUT", // (H)
          "BALANCE", // (I)
          "BALANCE QTY HISTORY", // Starting at column J (index 9)
          "", // Sub-header: CURRENT (K)
          "", // Sub-header: 30 DAY (L)
          "", // Sub-header: 60 DAY (M)
          "", // Sub-header: 90 DAY (N)
          "", // Sub-header: 120 DAY (O)
          ""  // Sub-header: OVER 150 (P)
        ];
        
        // Row 5: Sub-headers row - DATE, Customs Ref., LOT, BATCH here
        const subHeaders = [
          "DATE",
          "Customs Ref.",
          "LOT",
          "BATCH",
          "QTY", // Under STOCK IN
          "Customer Ref.", // Customer Ref. column
          "Customer Name", // Customer Name column
          "QTY",
          "QTY",
          "CURRENT",
          "30 DAY",
          "60 DAY",
          "90 DAY",
          "120 DAY",
          "OVER 150"
        ];
        
        excelData.push(mainHeaders);
        excelData.push(subHeaders);
        
        // Calculate running balance and aging history for each transaction
        // Use FIFO to track inventory items with their stock in dates
        const inventoryItems = []; // Array of {date, qty} objects
        const transactionRows = [];
        
        transactions.forEach(trans => {
          const stockInQty = trans.stockInQty || 0;
          const stockOutQty = trans.stockOutQty || 0;
          
          // Add items to inventory (with stock in date)
          if (stockInQty > 0 && trans.date) {
            inventoryItems.push({ date: trans.date, qty: stockInQty });
          }
          
          // Remove items from inventory (FIFO - remove oldest first)
          let remainingOut = stockOutQty;
          while (remainingOut > 0 && inventoryItems.length > 0) {
            const oldest = inventoryItems[0];
            if (oldest.qty <= remainingOut) {
              remainingOut -= oldest.qty;
              inventoryItems.shift();
            } else {
              oldest.qty -= remainingOut;
              remainingOut = 0;
            }
          }
          
          // Calculate current balance
          const runningBalance = inventoryItems.reduce((sum, item) => sum + item.qty, 0);
          
          // Calculate aging history for current inventory at transaction date
          // Aging shows how old items are at the time of this transaction
          const aging = {
            current: 0,
            day30: 0,
            day60: 0,
            day90: 0,
            day120: 0,
            over150: 0
          };
          
          // Use transaction date for aging calculation
          const transDate = trans.date ? new Date(trans.date) : new Date();
          
          inventoryItems.forEach(item => {
            if (item.date) {
              const itemDate = new Date(item.date);
              const diffTime = transDate - itemDate;
              const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              const category = getAgingCategory(days);
              
              if (category === "CURRENT") aging.current += item.qty;
              else if (category === "30DAY") aging.day30 += item.qty;
              else if (category === "60DAY") aging.day60 += item.qty;
              else if (category === "90DAY") aging.day90 += item.qty;
              else if (category === "120DAY") aging.day120 += item.qty;
              else if (category === "OVER150") aging.over150 += item.qty;
            }
          });
          
          transactionRows.push({
            date: formatDateToDDMMYYYY(trans.date),
            customsRef: trans.customsRef,
            lot: trans.lot,
            batch: trans.batch,
            stockInQty: stockInQty,
            customerRef: trans.customerRef,
            customerName: trans.customerName,
            stockOutQty: stockOutQty,
            balanceQty: runningBalance,
            ...aging
          });
        });
        
        // Add transaction rows
        transactionRows.forEach(row => {
          excelData.push([
            row.date,                    // DATE
            row.customsRef,            // Customs Ref.
            row.lot,                    // LOT
            "",                         // BATCH - empty
            formatNumber(row.stockInQty), // STOCK IN - QTY
            "",            // STOCK IN - Customer Ref. row.customerRef
            "",           // STOCK IN - Customer Name row.customerName
            formatNumber(row.stockOutQty), // STOCK OUT - QTY
            formatNumber(row.balanceQty), // BALANCE - QTY
            formatNumber(row.current),   // CURRENT
            formatNumber(row.day30),     // 30 DAY
            formatNumber(row.day60),     // 60 DAY
            formatNumber(row.day90),     // 90 DAY
            formatNumber(row.day120),    // 120 DAY
            formatNumber(row.over150)    // OVER 150
          ]);
        });
        
        // Calculate totals - only STOCK IN QTY and STOCK OUT QTY
        const totals = {
          stockInQty: transactions.reduce((sum, t) => sum + (t.stockInQty || 0), 0),
          stockOutQty: transactions.reduce((sum, t) => sum + (t.stockOutQty || 0), 0)
        };
        
        // Add TOTAL row - only STOCK IN QTY and STOCK OUT QTY
        excelData.push([
          "TOTAL",
          "", "", "", // DATE, Customs Ref., LOT, BATCH
          formatNumber(totals.stockInQty), // STOCK IN - QTY
          "", "", // Customer Ref., Customer Name
          formatNumber(totals.stockOutQty), // STOCK OUT - QTY
          "", // BALANCE (merged header)
          "", // BALANCE QTY - empty
          "", // BALANCE QTY HISTORY (merged header)
          "", "", "", "", "", "" // Aging columns - empty
        ]);
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Set column widths (18 columns total)
        ws['!cols'] = [
          { wch: 12 },  // DATE
          { wch: 15 },  // Customs Ref.
          { wch: 8 },   // LOT
          { wch: 12 },  // BATCH
          { wch: 12 },  // STOCK IN - QTY
          { wch: 15 },  // STOCK IN - Customer Ref.
          { wch: 20 },  // STOCK IN - Customer Name
          { wch: 12 },  // STOCK OUT (merged header)
          { wch: 12 },  // STOCK OUT - QTY
          { wch: 12 },  // BALANCE (merged header)
          { wch: 12 },  // BALANCE - QTY
          { wch: 12 },  // BALANCE QTY HISTORY (merged header)
          { wch: 12 },  // CURRENT
          { wch: 12 },  // 30 DAY
          { wch: 12 },  // 60 DAY
          { wch: 12 },  // 90 DAY
          { wch: 12 },  // 120 DAY
          { wch: 12 }   // OVER 150
        ];
        
        // Merge cells for main headers
        // Row indices: 0=headerRow1, 1=headerRow2, 2=headerRow3, 3=mainHeaders (row 4), 4=subHeaders (row 5)
        // Column indices: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14
        if (!ws['!merges']) ws['!merges'] = [];
        // STOCK IN - no merge, show as separate columns
        // Merge STOCK OUT header (row 3, col 7) - single cell (H)
        ws['!merges'].push({ s: { r: 3, c: 7 }, e: { r: 3, c: 7 } });
        // Merge BALANCE header (row 3, col 8) - single cell (I)
        ws['!merges'].push({ s: { r: 3, c: 8 }, e: { r: 3, c: 8 } });
        // Merge BALANCE QTY HISTORY header (row 3, col 9-14) - spans columns J-O (6 columns: J, K, L, M, N, O)
        ws['!merges'].push({ s: { r: 3, c: 9 }, e: { r: 3, c: 14 } });
        
        // Add worksheet to workbook (sheet name limited to 31 chars)
        const sheetName = size.length > 31 ? size.substring(0, 31) : size;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
      
      // Generate file name
      const fileName = `Summary_Stock_card_Report_${dateTo}.xlsx`;
      
      // Write file
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error exporting Excel", error);
      await Swal.fire({
        icon: "error",
        title: "Export failed",
        text: error?.message || "Could not export Excel.",
        confirmButtonText: "OK",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
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
                  <span className="color-link">Summary Stock card Report</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Summary Stock card Report
            </div>

            <div className="card-body gap-margin">
              <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 100 }}>Vendor</span>
                  <select
                    className="form-control angle"
                    value={selectedVendor}
                    onChange={(e) => { setSelectedVendor(e.target.value); }}
                    style={{ minWidth: 200 }}
                  >
                    <option value="">All Vendors</option>
                    {allVendors.map((vendor, idx) => (
                      <option key={idx} value={vendor}>{vendor}</option>
                    ))}
                  </select>
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 80 }}>Date To</span>
                  <DatePicker
                    selected={ymdToDate(dateTo)}
                    onChange={(d) => { setDateTo(dateToYMD(d)); }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="form-control angle"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    portalId="root"
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-secondary angle" onClick={onClear} disabled={loading}>Clear</button>
                </label>
                <div style={{ flex: 1 }} />
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button 
                    className="btn btn-success angle" 
                    onClick={exportToExcel} 
                    disabled={loading || rows.length === 0 || exporting}
                  >
                    {exporting ? "EXPORTING..." : "Export Excel"}
                  </button>
                </label>
              </div>

              {/* Table */}
              <div className="table-wrapper table-h-scroll table-resize mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>📄 No Data</div>
                ) : (
                  <table className="table table-bordered table-striped table-custom table-compact">
                    <colgroup>
                      <col className="col-balance-partno" />
                      <col className="col-balance-stockin" />
                      <col className="col-balance-stockout" />
                      <col className="col-balance-balance" />
                      <col className="col-balance-current" />
                      <col className="col-balance-30day" />
                      <col className="col-balance-60day" />
                      <col className="col-balance-90day" />
                      <col className="col-balance-120day" />
                      <col className="col-balance-over150" />
                    </colgroup>
                    <thead className="text-center">
                      <tr>
                        <th>PART NO.</th>
                        <th>STOCK IN QTY</th>
                        <th>STOCK OUT QTY</th>
                        <th>BALANCE QTY</th>
                        <th>CURRENT</th>
                        <th>30 DAY</th>
                        <th>60 DAY</th>
                        <th>90 DAY</th>
                        <th>120 DAY</th>
                        <th>OVER 150</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td className="text-center">{row.partNo}</td>
                          <td className="text-right">{row.stockInQty}</td>
                          <td className="text-right">{row.stockOutQty}</td>
                          <td className="text-right">{row.balanceQty}</td>
                          <td className="text-right">{row.current}</td>
                          <td className="text-right">{row.day30}</td>
                          <td className="text-right">{row.day60}</td>
                          <td className="text-right">{row.day90}</td>
                          <td className="text-right">{row.day120}</td>
                          <td className="text-right">{row.over150}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontStyle: "italic" }}>
                  Total rows: {Number(rows.length || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

