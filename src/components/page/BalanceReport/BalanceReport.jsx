import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { httpClient } from '../../../utils/HttpClient';
import './BalanceReport.css';
import Swal from 'sweetalert2';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from 'xlsx';

const PAGE_SIZE = 50;

const BalanceReport = () => {
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef(null);

  const [ctrlDeclarationNo, setCtrlDeclarationNo] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const endpointList = "/api/transaction-movement/balance-report";

  const pluckRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result)) return payload.result;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  const pluckTotal = (payload) => {
    const n = payload?.data?.count ?? payload?.total ?? payload?.count ?? payload?.pagination?.total ?? payload?.result?.total ?? payload?.result?.count ?? 0;
    return Number(n) || 0;
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

  const fetchPage = async (pageNo = 1, size = PAGE_SIZE) => {
    setLoading(true);
    try {
      const params = {
        page: pageNo,
        pageSize: size,
        ctrlDeclarationNo: ctrlDeclarationNo || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
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
      console.error("[BalanceReport] fetchPage error:", e);
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
  }, [ctrlDeclarationNo, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const onClear = () => {
    setCtrlDeclarationNo("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const goPrev = () => { if (page > 1) fetchPage(page - 1); };
  const goNext = () => { if (page < totalPages) fetchPage(page + 1); };

  const exportExcel = () => {

    // Build title rows
    const fmtDDMMYYYY = (d) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      } catch { return ''; }
    };
    const periodFrom = fmtDDMMYYYY(dateFrom);
    const periodTo = fmtDDMMYYYY(dateTo);

    const title1Left = 'คลังสินค้าทัณฑ์บนทั่วไป บริษัท เอ็นเอ็มบี-มินีแบไทย จำกัด รหัส W000000000000';
    const title1Right = 'คทบ 17';
    const title2 = 'รายงานของคงเหลือในคลังสินค้าทัณฑ์บน ( Balance Stock )';
    const title3 = `ระหว่างวันที่ -  ถึงวันที่   ( Period ${periodFrom} -${periodTo} )`;
    const title4 = '*รายงานนี้จะดึงเฉพาะรายการใบขนที่มียอดคงเหลือ รายการใบขนไหนยอดเป็นศูนย์ ให้ตัดออก และยังต้องมียอดรวมคั่นทีละใบขนฯ  ยอดของรายงานนี้จะต้องเท่ากับยอดคงเหลือใน 1-13';

    // Headers
    const headers = [
      'ลำดับที่',
      'ชื่อผู้นำเข้า',
      'วันนำเข้า',
      'วันนำเข้าคลังฯ',
      'เลขที่ใบขนนำเข้าคลังฯ',
      'รายการที่บนใบขน',
      'ชื่อสินค้า',
      'ปริมาณคงเหลือ',
      'หน่วย',
      'น้ำหนักคงเหลือ',
      'หน่วย',
      'มูลค่า(บาท)',
      'อากร(บาท)'
    ];

    // Compose excel data
    const excelData = [];
    const mergeColCount = headers.length; // 13 columns (0..12)
    const blankRow = new Array(mergeColCount).fill('');
    // Title row 1: merge 0-11 and put label at 12
    const t1 = [...blankRow];
    t1[0] = title1Left;
    t1[12] = title1Right;
    excelData.push(t1);
    // Title row 2-4 in col0 (merged later)
    const t2 = [...blankRow]; t2[0] = title2; excelData.push(t2);
    const t3 = [...blankRow]; t3[0] = title3; excelData.push(t3);
    const t4 = [...blankRow]; t4[0] = title4; excelData.push(t4);
    excelData.push(headers);

    // Group by importer
    const grouped = {};
    (rows || []).forEach((r, i) => {
      const key = r.importerNameEN || r.exporterNameEN || `unknown_${i}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ...r, __i: i });
    });

    // Helper to compute balance qty/value/tax per row
    const calcRow = (r) => {
      const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
      const takeout = unit === 'KGM'
        ? (Number(r.transactionNetWeight) || 0)
        : (Number(r.transactionQuantity) || 0);
      const qty = Number(r.quantity) || 0;
      const balanceQty = Math.max(0, qty - takeout);
      const value = (r.cifTHB && qty) ? ((Number(r.cifTHB) / (qty || 1)) * balanceQty) : 0;
      const duty = (r.dutyAmt && qty) ? ((Number(r.dutyAmt) / (qty || 1)) * balanceQty) : 0;
      return { balanceQty, value, duty };
    };

    // Build rows and per-unit TOTAL rows
    let rowNo = 1;
    Object.keys(grouped).sort().forEach(importer => {
      const items = grouped[importer];

      items.forEach((r, idx) => {
        const isFirst = idx === 0;
        const { balanceQty, value, duty } = calcRow(r);
        if (balanceQty <= 0) return; // skip zero-balance rows
        excelData.push([
          isFirst ? rowNo : '',
          isFirst ? (r.importerNameEN || r.exporterNameEN || '') : '',
          isFirst ? fmtThaiDate(r.arrivalDate || r.createdAt) : '',
          isFirst ? fmtThaiDate(r.stockInDate || '') : '',
          isFirst ? (r.ctrlDeclarationNo || '') : '',
          r.itemNo || (idx + 1),
          r.description || '',
          balanceQty.toFixed(3),
          r.unit || 'KGM',
          balanceQty.toFixed(3),
          r.unit || 'KGM',
          value.toFixed(2),
          duty.toFixed(2)
        ]);
        if (isFirst) rowNo++;
      });

      // Unit groups for TOTAL rows
      const unitGroups = {};
      items.forEach(r => {
        const u = r.unit || 'KGM';
        if (!unitGroups[u]) unitGroups[u] = [];
        unitGroups[u].push(r);
      });

      Object.keys(unitGroups).sort().forEach(u => {
        let totalBal = 0, totalVal = 0, totalDuty = 0;
        unitGroups[u].forEach(r => {
          const { balanceQty, value, duty } = calcRow(r);
          if (balanceQty > 0) {
            totalBal += balanceQty;
            totalVal += value;
            totalDuty += duty;
          }
        });
        excelData.push([
          '', '', '', '', '',
          `รวม (${u})`,
          u,
          totalBal.toFixed(3),
          u,
          totalBal.toFixed(3),
          u,
          totalVal.toFixed(2),
          totalDuty.toFixed(2)
        ]);
      });
    });

    // GRAND Total per unit and final row
    const allUnits = {};
    (rows || []).forEach(r => {
      const u = r.unit || 'KGM';
      if (!allUnits[u]) allUnits[u] = { qty: 0, value: 0, duty: 0 };
      const { balanceQty, value, duty } = calcRow(r);
      allUnits[u].qty += balanceQty;
      allUnits[u].value += value;
      allUnits[u].duty += duty;
    });

    Object.keys(allUnits).sort().forEach(u => {
      const g = allUnits[u];
      excelData.push([
        '', '', '', '', '',
        `รวมทั้งหมด(${u})`, // col 6
        '',                  // col 7 (merged with 6)
        g.qty.toFixed(3),    // col 8 ปริมาณคงเหลือ
        '',                  // col 9 หน่วย
        g.qty.toFixed(3),    // col 10 น้ำหนักคงเหลือ
        '',                  // col 11 หน่วย
        g.value.toFixed(2),  // col 12 มูลค่า(บาท)
        g.duty.toFixed(2)    // col 13 อากร(บาท)
      ]);
    });

    const grandValue = Object.values(allUnits).reduce((s, g) => s + g.value, 0);
    const grandDuty = Object.values(allUnits).reduce((s, g) => s + g.duty, 0);
    excelData.push([
      '', '', '', '', '',
      'รวมทั้งสิ้น', // col 6
      '',             // col 7 (merged with 6)
      '',             // col 8
      '',             // col 9
      '',             // col 10
      '',             // col 11 หน่วย
      grandValue.toFixed(2), // col 12 มูลค่า(บาท)
      grandDuty.toFixed(2)   // col 13 อากร(บาท)
    ]);

    // Create workbook and sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Column widths
    ws['!cols'] = [
      { wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 25 },
      { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
    ];

    // Merge title rows: row0 col0-11, row1-3 col0-12
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } });
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 12 } });
    ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 12 } });
    ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 12 } });

    // Merge grouped columns (0-4) across each importer block (data rows + unit totals)
    let headerOffset = 5; // 4 title + 1 header
    let currentRow = headerOffset;
    Object.keys(grouped).sort().forEach(importer => {
      const items = grouped[importer];
      const unitCount = Object.keys(items.reduce((acc, r) => { acc[r.unit || 'KGM'] = true; return acc; }, {})).length;
      const totalRowsForGroup = items.length + unitCount;
      const endRow = currentRow + totalRowsForGroup - 1;
      [0,1,2,3,4].forEach(c => {
        ws['!merges'].push({ s: { r: currentRow, c }, e: { r: endRow, c } });
      });
      // Merge "รวม (TOTAL)" label across columns 5-6 for each unit total row
      for (let i = 0; i < unitCount; i++) {
        const r = currentRow + items.length + i;
        ws['!merges'].push({ s: { r, c: 5 }, e: { r, c: 6 } });
      }
      currentRow += totalRowsForGroup;
    });

    // Merge 5-6 for all GRAND total rows at bottom (ตามที่ขอ: รวมทั้งหมด / รวมทั้งสิ้น ให้ merge 5-6)
    const grandStart = currentRow;
    const grandRows = Object.keys(allUnits).length + 1; // + final grand row
    const grandEnd = grandStart + grandRows - 1;
    for (let r = grandStart; r <= grandEnd; r++) {
      ws['!merges'].push({ s: { r, c: 5 }, e: { r, c: 6 } });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'คทบ.17 Report');
    const fileName = `คทบ.17_Report.xlsx`;
    XLSX.writeFile(wb, fileName);
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
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">คทบ.17 REPORT</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              คทบ.17 Report
            </div>

            <div className="card-body gap-margin">
              <div className="controls" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 200 }}>เลขที่ใบขนสินค้า</span>
                  <input 
                    type="text" 
                    className="form-control angle" 
                    value={ctrlDeclarationNo} 
                    onChange={(e) => { setCtrlDeclarationNo(e.target.value); setPage(1); }} 
                    placeholder="Search by Import Entry number" 
                    style={{ minWidth: 150 }} 
                  />
                </label>

                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 80 }}>Date from</span>
                  <DatePicker
                    selected={ymdToDate(dateFrom)}
                    onChange={(d) => { setDateFrom(dateToYMD(d)); setPage(1); }}
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
                  <span className="vp-label" style={{ minWidth: 60 }}>to</span>
                  <DatePicker
                    selected={ymdToDate(dateTo)}
                    onChange={(d) => { setDateTo(dateToYMD(d)); setPage(1); }}
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
                  <button className="btn btn-success angle" onClick={exportExcel} disabled={loading || rows.length === 0}>Export Excel</button>
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
                      <col className="col-balance-no" />
                      <col className="col-balance-importer" />
                      <col className="col-balance-eta" />
                      <col className="col-balance-stockin" />
                      <col className="col-balance-entry" />
                      <col className="col-balance-item" />
                      <col className="col-balance-desc" />
                      <col className="col-balance-qty" />
                      <col className="col-balance-unit" />
                      <col className="col-balance-weight" />
                      <col className="col-balance-weight-unit" />
                      <col className="col-balance-value" />
                      <col className="col-balance-tax" />
                    </colgroup>
                    <thead className="text-center">
                      <tr>
                        <th rowSpan="2">ลำดับที่</th>
                        <th rowSpan="2">ชื่อผู้นำเข้า</th>
                        <th rowSpan="2">วันนำเข้า</th>
                        <th rowSpan="2">วันนำเข้าคลังฯ</th>
                        <th rowSpan="2">เลขที่ใบขนนำเข้าคลังฯ</th>
                        <th rowSpan="2">รายการที่บนใบขน</th>
                        <th rowSpan="2">ชื่อสินค้า</th>
                        <th rowSpan="2">ปริมาณคงเหลือ</th>
                        <th rowSpan="2">หน่วย</th>
                        <th rowSpan="2">น้ำหนักคงเหลือ</th>
                        <th rowSpan="2">หน่วย</th>
                        <th rowSpan="2">มูลค่า(บาท)</th>
                        <th rowSpan="2">อากร(บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{r.importerNameEN || r.exporterNameEN || `ผู้นำเข้า ${i + 1}`}</td>
                          <td>{fmtThaiDate(r.arrivalDate || r.createdAt)}</td>
                          <td>{fmtThaiDate(r.receivedDate || '')}</td>
                          <td>{r.ctrlDeclarationNo || `A${String(i + 1).padStart(3, '0')}`}</td>
                          <td>{r.itemNo || (i + 1)}</td>
                          <td>{r.description || `สินค้า ${String.fromCharCode(65 + i)}`}</td>
                          <td>{(() => {
                            const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                            const takeout = unit === 'KGM'
                              ? (Number(r.transactionNetWeight) || 0)
                              : (Number(r.transactionQuantity) || 0);
                            return r.quantity ? (Number(r.quantity) - takeout).toFixed(3) : '0.000';
                          })()}</td>
                          <td>{r.unit || 'KGM'}</td>
                          <td>{(() => {
                            const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                            const takeout = unit === 'KGM'
                              ? (Number(r.transactionNetWeight) || 0)
                              : (Number(r.transactionQuantity) || 0);
                            return r.quantity ? (Number(r.quantity) - takeout).toFixed(3) : '0.000';
                          })()}</td>
                          <td>{r.unit || 'KGM'}</td>
                          <td>{(r.cifTHB && r.quantity)
                            ? (() => {
                                const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                                const takeout = unit === 'KGM'
                                  ? (Number(r.transactionNetWeight) || 0)
                                  : (Number(r.transactionQuantity) || 0);
                                const qty = Number(r.quantity) || 0;
                                const balance = Math.max(0, qty - takeout);
                                return ((Number(r.cifTHB) / (qty || 1)) * balance).toFixed(2);
                              })()
                            : '0.00'}</td>
                          <td>{(r.dutyAmt && r.quantity)
                            ? (() => {
                                const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                                const takeout = unit === 'KGM'
                                  ? (Number(r.transactionNetWeight) || 0)
                                  : (Number(r.transactionQuantity) || 0);
                                const qty = Number(r.quantity) || 0;
                                const balance = Math.max(0, qty - takeout);
                                return ((Number(r.dutyAmt) / (qty || 1)) * balance).toFixed(2);
                              })()
                            : '0.00'}</td>
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
    </div>
  );
};

export default BalanceReport;