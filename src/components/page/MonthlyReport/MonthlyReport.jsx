import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./MonthlyReport.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from 'xlsx';

const PAGE_SIZE = 50;

export default function MonthlyReport() {
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

  const endpointList = "/api/v1/monthlydata/getdata";

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
        limit: size,
        ctrlDeclarationNo: ctrlDeclarationNo || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const resp = await httpClient.get(endpointList, { ...authHeaders(), params });
      const data = resp?.data ?? {};
      const list = pluckRows(data);
      const ttl = pluckTotal(data);

      // จัดกลุ่มข้อมูลตามชื่อผู้นำเข้า
      const groupedData = {};
      list.forEach((item, index) => {
        const importerKey = item.importerNameEN || `unknown_${index}`;
        if (!groupedData[importerKey]) {
          groupedData[importerKey] = [];
        }
        groupedData[importerKey].push({ ...item, originalIndex: index });
      });

      // แปลงเป็น array ที่เรียงตามชื่อผู้นำเข้า
      const sortedRows = [];
      Object.keys(groupedData).sort().forEach(importerKey => {
        groupedData[importerKey].forEach(item => {
          sortedRows.push(item);
        });
      });

      setRows(sortedRows);
      setTotal(ttl || list.length);
      setPage(pageNo);
      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[MonthlyReport] fetchPage error:", e);
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
    try {
      // สร้างข้อมูลสำหรับ Excel
      const excelData = [];
      
      // เพิ่ม preface rows (หัวรายงานด้านบน)
      const fmtDDMMYYYY = (d) => {
        if (!d) return "";
        try {
          const dt = new Date(d);
          const dd = String(dt.getDate()).padStart(2, "0");
          const mm = String(dt.getMonth() + 1).padStart(2, "0");
          const yyyy = dt.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        } catch {
          return "";
        }
      };
      const periodFrom = fmtDDMMYYYY(dateFrom);
      const periodTo = fmtDDMMYYYY(dateTo);
      const titleRow1 = "คลังสินค้าทัณฑ์บนทั่วไป บริษัท เอ็นเอ็มบี-มินีแบ ไทย จำกัด เลขทะเบียนสิทธิประโยชน์ทางภาษีอากร A029-0-6810-11842";
      const titleRow2 = "รายงานการนำของเข้าเก็บในคลังสินค้าทัณฑ์บนทั่วไป   ";
      const titleRow3 = `ระหว่างวันที่  (  Period ${periodFrom} -${periodTo}  )`;

      // เพิ่ม multi-level headers
      const headers = [
        "ลำดับที่ (NO)",
        "ชื่อผู้นำเข้า (Importer Name)",
        "วันที่นำเข้า (ETA)",
        "วันที่นำเข้าคลังฯ (Stock In Date)",
        "เลขที่ใบขนสินค้า นำเข้าคลังฯ (Import Entry number)",
        "ประเทศต้นทาง (Consignment Country)",
        "รายการที่ (Entry SEQ)",
        "ชนิดของเป็นภาษาอังกฤษ (Description-English)",
        "หน่วย (Unit)",
        "ปริมาณ (Quantity)",
        "น้ำหนัก (Net Weight)",
        "มูลค่าของต่างประเทศ (Foreign Value)",
        "หน่วยเงินต่างประเทศ (Foreign Currency Unit)",
        "มูลค่า (Value)",
        "พิกัด (Tariff)",
        "อัตราอากร (Duty Rate)",
        "ภาษีอากร (Duty Tax)",
        "หมายเหตุ (Remarks)"
      ];
      
      // เพิ่ม preface rows และ header row
      const mergeColCount = 17; // รวม 1 x 17 คอลัมน์ (คอลัมน์ 0-16)
      const blankRow17 = new Array(mergeColCount - 1).fill("");
      excelData.push(
        [titleRow1, ...blankRow17],
        [titleRow2, ...blankRow17],
        [titleRow3, ...blankRow17],
        headers
      );
      
      // จัดกลุ่มข้อมูลตามชื่อผู้นำเข้า (เรียงตามตัวอักษร)
      const groupedData = {};
      (rows || []).forEach((r, i) => {
        const importerKey = r.importerNameEN || `unknown_${i}`;
        if (!groupedData[importerKey]) {
          groupedData[importerKey] = [];
        }
        groupedData[importerKey].push({ ...r, originalIndex: i });
      });

      // เพิ่มข้อมูลแบบจัดกลุ่ม (เรียงตามชื่อผู้นำเข้า)
      let rowNumber = 1;
      Object.keys(groupedData).sort().forEach(importerKey => {
        const items = groupedData[importerKey];
        
        // เพิ่มข้อมูลทั้งหมดก่อน (ไม่แยกตาม unit)
        items.forEach((r, itemIndex) => {
          const isFirstItem = itemIndex === 0;
          const rowData = [
            isFirstItem ? rowNumber : "", // ลำดับที่ (แสดงเฉพาะแถวแรกของแต่ละกลุ่ม)
            isFirstItem ? r.importerNameEN || "" : "", // ชื่อผู้นำเข้า (แสดงเฉพาะแถวแรกของแต่ละกลุ่ม)
            isFirstItem ? fmtThaiDate(r.arrivalDate) : "", // วันที่นำเข้า (ETA) (แสดงเฉพาะแถวแรก)
            isFirstItem ? fmtThaiDate(r.receivedDate) : "", // วันที่นำเข้าคลังฯ (Stock In Date) (แสดงเฉพาะแถวแรก)
            isFirstItem ? r.ctrlDeclarationNo || "" : "", // เลขที่ใบขนสินค้า (แสดงเฉพาะแถวแรก)
            isFirstItem ? r.consignmentCountry || "" : "", // ประเทศต้นทาง (แสดงเฉพาะแถวแรก)
            itemIndex + 1, // รายการที่ (เรียงลำดับ 1, 2, 3...)
            r.description || "", // ชนิดของเป็นภาษาอังกฤษ (แสดงทุกแถว)
            r.unit || "", // หน่วยของปริมาณ
            r.quantity || "", // ปริมาณ
            r.netWeight || "", // น้ำหนัก
            r.amount || "", // มูลค่าของต่างประเทศ
            r.currency || "", // หน่วยเงินต่างประเทศ
            r.cifTHB || "", // มูลค่า
            r.tariff ? r.tariff.substring(4) : "", // พิกัด (ตัด 4 ตัวแรก)
            r.dutyRate ? `${r.dutyRate}%` : "", // อัตราอากร
            r.dutyAmt || "", // ภาษีอากร
            r.remarks || "" // หมายเหตุ
          ];
          excelData.push(rowData);
          
          if (isFirstItem) {
            rowNumber++;
          }
        });

        // จัดกลุ่มข้อมูลตาม unit เพื่อสร้างแถวรวม
        const unitGroups = {};
        items.forEach(item => {
          const unit = item.unit || "";
          if (!unitGroups[unit]) {
            unitGroups[unit] = [];
          }
          unitGroups[unit].push(item);
        });

        // เพิ่มแถว "รวม(TOTAL)" สำหรับแต่ละ unit
        Object.keys(unitGroups).sort().forEach(unit => {
          const unitItems = unitGroups[unit];
          const totalQuantity = unitItems.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
          const totalNetWeight = unitItems.reduce((sum, item) => sum + parseFloat(item.netWeight || 0), 0);
          const totalCifTHB = unitItems.reduce((sum, item) => sum + parseFloat(item.cifTHB || 0), 0);
          const totalDutyAmt = unitItems.reduce((sum, item) => sum + parseFloat(item.dutyAmt || 0), 0);
          
          const totalRow = [
            "", // ลำดับที่
            "", // ชื่อผู้นำเข้า
            "", // วันที่นำเข้า
            "", // วันที่นำเข้าคลังฯ
            "", // เลขที่ใบขนสินค้า
            "", // ประเทศต้นทาง
            "", // รายการที่
            "รวม (TOTAL)", // ชนิดของเป็นภาษาอังกฤษ
            unit, // หน่วยของปริมาณ
            totalQuantity.toFixed(3), // ปริมาณ
            totalNetWeight.toFixed(3), // น้ำหนัก
            "", // มูลค่าของต่างประเทศ
            "", // หน่วยเงินต่างประเทศ
            totalCifTHB.toFixed(2), // มูลค่า
            "", // พิกัด
            "", // อัตราอากร
            totalDutyAmt.toFixed(2), // ภาษีอากร
            "" // หมายเหตุ
          ];
          excelData.push(totalRow);
        });
      });

      // เพิ่มแถวสรุปสุดท้าย (Grand Total)
      const allUnits = {};
      (rows || []).forEach(r => {
        const unit = r.unit || "";
        if (!allUnits[unit]) {
          allUnits[unit] = {
            quantity: 0,
            netWeight: 0,
            value: 0,
            dutyTax: 0
          };
        }
        allUnits[unit].quantity += parseFloat(r.quantity || 0);
        allUnits[unit].netWeight += parseFloat(r.netWeight || 0);
        allUnits[unit].value += parseFloat(r.cifTHB || 0);
        allUnits[unit].dutyTax += parseFloat(r.dutyAmt || 0);
      });

      // เพิ่มแถว Grand Total สำหรับแต่ละ unit
      Object.keys(allUnits).sort().forEach(unit => {
        const group = allUnits[unit];
        const grandTotalRow = [
          `รวมทั้งหมด (GRAND Total) (${unit})`, // ลำดับที่ (merge กับคอลัมน์อื่น)
          "", // ชื่อผู้นำเข้า
          "", // วันที่นำเข้า
          "", // วันที่นำเข้าคลังฯ
          "", // เลขที่ใบขนสินค้า
          "", // ประเทศต้นทาง
          "", // รายการที่
          "", // ชนิดของเป็นภาษาอังกฤษ
          "", // หน่วยของปริมาณ (ว่างสำหรับแถวรวม)
          group.quantity.toFixed(3), // ปริมาณ
          group.netWeight.toFixed(3), // น้ำหนัก
          "", // มูลค่าของต่างประเทศ
          "", // หน่วยเงินต่างประเทศ
          group.value.toFixed(2), // มูลค่า
          "", // พิกัด
          "", // อัตราอากร
          group.dutyTax.toFixed(2), // ภาษีอากร
          "" // หมายเหตุ
        ];
        excelData.push(grandTotalRow);
      });

      // เพิ่มแถวสรุปสุดท้าย (Grand Total ทั้งหมด)
      const grandTotalQuantity = Object.values(allUnits).reduce((sum, group) => sum + group.quantity, 0);
      const grandTotalNetWeight = Object.values(allUnits).reduce((sum, group) => sum + group.netWeight, 0);
      const grandTotalValue = Object.values(allUnits).reduce((sum, group) => sum + group.value, 0);
      const grandTotalDutyTax = Object.values(allUnits).reduce((sum, group) => sum + group.dutyTax, 0);
      
      const finalGrandTotalRow = [
        "รวมมูลค่าและอากรทั้งสิ้น (Grand Total value and duty)", // ลำดับที่ (merge กับคอลัมน์อื่น)
        "", // ชื่อผู้นำเข้า
        "", // วันที่นำเข้า
        "", // วันที่นำเข้าคลังฯ
        "", // เลขที่ใบขนสินค้า
        "", // ประเทศต้นทาง
        "", // รายการที่
        "", // ชนิดของเป็นภาษาอังกฤษ
        "", // หน่วยของปริมาณ (ว่างสำหรับแถวรวม)
        "", // ปริมาณ (ว่าง)
        "", // น้ำหนัก (ว่าง)
        "", // มูลค่าของต่างประเทศ (ว่าง)
        "", // หน่วยเงินต่างประเทศ (ว่าง)
        grandTotalValue.toFixed(2), // มูลค่า
        "", // พิกัด (ว่าง)
        "", // อัตราอากร (ว่าง)
        grandTotalDutyTax.toFixed(2), // ภาษีอากร
        "" // หมายเหตุ (ว่าง)
      ];
      excelData.push(finalGrandTotalRow);

      // สร้าง workbook และ worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // ตั้งค่า column widths
      const colWidths = [
        { wch: 8 },   // ลำดับที่
        { wch: 25 },  // ชื่อผู้นำเข้า
        { wch: 12 },  // วันที่นำเข้า
        { wch: 12 },  // วันที่นำเข้าคลังฯ
        { wch: 18 },  // เลขที่ใบขนสินค้า
        { wch: 8 },   // ประเทศต้นทาง
        { wch: 8 },   // รายการที่
        { wch: 30 },  // ชนิดของเป็นภาษาอังกฤษ
        { wch: 8 },   // หน่วย
        { wch: 10 },  // ปริมาณ
        { wch: 12 },  // น้ำหนัก
        { wch: 15 },  // มูลค่าของต่างประเทศ
        { wch: 8 },   // หน่วยเงินต่างประเทศ
        { wch: 12 },  // มูลค่า
        { wch: 12 },  // พิกัด
        { wch: 10 },  // อัตราอากร
        { wch: 12 },  // ภาษีอากร
        { wch: 15 }   // หมายเหตุ
      ];
      ws['!cols'] = colWidths;

      // ตั้งค่า merge cells และ alignment สำหรับคอลัมน์ที่ต้อง merge
      const prefaceRows = 3; // จำนวนบรรทัดหัวรายงานที่เพิ่มเข้าไป
      const headerOffset = prefaceRows + 1; // รวม header อีก 1 แถว
      let currentRow = headerOffset; // เริ่มหลังจากหัวรายงาน + header
      
      // คอลัมน์ที่ต้อง merge (index เริ่มจาก 0)
      const columnsToMerge = [
        0, // ลำดับที่ (NO)
        1, // ชื่อผู้นำเข้า (Importer Name)
        2, // วันที่นำเข้า (ETA)
        3, // วันที่นำเข้าคลังฯ (Stock In Date)
        4, // เลขที่ใบขนสินค้า นำเข้าคลังฯ (Import Entry number)
        5  // ประเทศต้นทาง (Consignment Country)
      ];
      
      Object.keys(groupedData).sort().forEach(importerKey => {
        const items = groupedData[importerKey];
        if (items.length > 0) {
          // จัดกลุ่มข้อมูลตาม unit
          const unitGroups = {};
          items.forEach(item => {
            const unit = item.unit || "";
            if (!unitGroups[unit]) {
              unitGroups[unit] = [];
            }
            unitGroups[unit].push(item);
          });

          // คำนวณจำนวน unit ที่แตกต่างกันสำหรับกลุ่มนี้
          const uniqueUnits = Object.keys(unitGroups).sort();
          const totalSummaryRows = uniqueUnits.length;
          
          // คำนวณจำนวนแถวสำหรับกลุ่มนี้ (ข้อมูล + แถวรวมตาม unit)
          const dataRowsForThisGroup = items.length;
          const totalRowsForThisGroup = dataRowsForThisGroup + totalSummaryRows;
          const endRow = currentRow + totalRowsForThisGroup - 1;
          
          // Merge cells สำหรับแต่ละคอลัมน์ที่ต้อง merge
          columnsToMerge.forEach(columnIndex => {
            const mergeRange = {
              s: { r: currentRow, c: columnIndex }, // เริ่มต้นที่คอลัมน์
              e: { r: endRow, c: columnIndex } // จบที่แถวสุดท้ายของกลุ่มนี้
            };
            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push(mergeRange);
            
            // ตั้งค่า alignment สำหรับแต่ละคอลัมน์ (เฉพาะช่วงที่ merge)
            for (let i = 0; i < totalRowsForThisGroup; i++) {
              const cellRef = XLSX.utils.encode_cell({ r: currentRow + i, c: columnIndex });
              if (!ws[cellRef]) ws[cellRef] = { v: "" };
              ws[cellRef].s = {
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin" },
                  bottom: { style: "thin" },
                  left: { style: "thin" },
                  right: { style: "thin" }
                }
              };
            }
          });

          // Merge เฉพาะแถว "รวม (TOTAL)" - รวมคอลัมน์ 6-7 (Entry SEQ และ Description)
          // สำหรับแต่ละแถวรวมตาม unit
          for (let i = 0; i < totalSummaryRows; i++) {
            const totalRowIndex = currentRow + dataRowsForThisGroup + i;
            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: totalRowIndex, c: 6 }, e: { r: totalRowIndex, c: 7 } });
            
            // ตั้งค่า style สำหรับแถวรวม
            for (let c = 6; c <= 7; c++) {
              const cellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c });
              const isLeft = c === 6;
              if (!ws[cellRef]) ws[cellRef] = { v: isLeft ? "รวม (TOTAL)" : "" };
              else if (isLeft) ws[cellRef].v = "รวม (TOTAL)";
              ws[cellRef].s = {
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin" },
                  bottom: { style: "thin" },
                  left: { style: "thin" },
                  right: { style: "thin" }
                }
              };
            }
          }
        }
        // คำนวณจำนวน unit ที่แตกต่างกันสำหรับกลุ่มนี้
        const unitGroups = {};
        items.forEach(item => {
          const unit = item.unit || "";
          if (!unitGroups[unit]) {
            unitGroups[unit] = [];
          }
          unitGroups[unit].push(item);
        });
        const uniqueUnits = Object.keys(unitGroups).sort();
        currentRow += items.length + uniqueUnits.length;
      });

      // Merge cells สำหรับแถว Grand Total
      const grandTotalStartRow = currentRow;
      const grandTotalRows = Object.keys(allUnits).length + 1; // +1 สำหรับแถวสุดท้าย
      const grandTotalEndRow = grandTotalStartRow + grandTotalRows - 1;
      
      // Merge คอลัมน์ 0-7 สำหรับแถว Grand Total
      for (let row = grandTotalStartRow; row <= grandTotalEndRow; row++) {
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: 7 } });
        
        // ตั้งค่า style สำหรับแถว Grand Total
        for (let c = 0; c <= 7; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c });
          const isFirst = c === 0;
          if (!ws[cellRef]) ws[cellRef] = { v: "" };
          ws[cellRef].s = {
            alignment: { horizontal: "center", vertical: "center" },
            font: { bold: true },
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          };
        }
      }

      // Merge preface rows ให้เป็น 1 x 17 ต่อแถว และจัดกึ่งกลาง
      if (!ws['!merges']) ws['!merges'] = [];
      for (let r = 0; r < prefaceRows; r++) {
        ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: mergeColCount - 1 } });
        for (let c = 0; c < mergeColCount; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) ws[cellRef] = { v: "" };
          ws[cellRef].s = {
            alignment: { horizontal: "center", vertical: "center" },
            font: { bold: true },
            border: {
              top: { style: "thin" },
              bottom: { style: "thin" },
              left: { style: "thin" },
              right: { style: "thin" }
            }
          };
        }
      }
      
      // เพิ่ม worksheet ลง workbook
      XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
      
      // export เป็นไฟล์
      const filename = `monthly_Report.xlsx`;
      XLSX.writeFile(wb, filename);
      
    } catch (err) {
      console.error("[MonthlyReport][exportExcel] error:", err);
      Swal.fire({ icon: "error", title: "Export failed", text: err?.message || "An error occurred while generating the file." });
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
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">MONTHLY REPORT</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Monthly Report
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

              <div className="table-wrapper table-h-scroll table-resize mt-3" ref={tableRef}>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : rows.length === 0 ? (
                  <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>📄 No Data</div>
                ) : (
                  <table className="table table-receive table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-report-no" />
                      <col className="col-report-importer" />
                      <col className="col-report-eta" />
                      <col className="col-report-stockin" />
                      <col className="col-report-entry" />
                      <col className="col-report-country" />
                      <col className="col-report-item" />
                      <col className="col-report-desc" />
                      <col className="col-report-qty" />
                      <col className="col-report-weight" />
                      <col className="col-report-amount" />
                      <col className="col-report-currency" />
                      <col className="col-report-cifthb" />
                      <col className="col-report-tariff" />
                      <col className="col-report-dutyrate" />
                      <col className="col-report-dutyamt" />
                      <col className="col-report-remarks" />
                    </colgroup>
                    <thead className="text-center">
                      <tr>
                        <th rowSpan="2">ลำดับที่ (NO)</th>
                        <th rowSpan="2">ชื่อผู้นำเข้า (Importer Name)</th>
                        <th rowSpan="2">วันที่นำเข้า (ETA)</th>
                        <th rowSpan="2">วันที่นำเข้าคลังฯ (Stock In Date)</th>
                        <th rowSpan="2">เลขที่ใบขนสินค้า นำเข้าคลังฯ (Import Entry number)</th>
                        <th rowSpan="2">ประเทศต้นทาง</th>
                        <th rowSpan="2">รายการที่ (Entry SEQ)</th>
                        <th rowSpan="2">ชนิดของเป็นภาษาอังกฤษ (Description-English)</th>
                        <th rowSpan="2">หน่วย</th>
                        <th rowSpan="2">ปริมาณ</th>
                        <th rowSpan="2">น้ำหนัก Net Weight</th>
                        <th rowSpan="2">มูลค่าของต่างประเทศ</th>
                        <th rowSpan="2">หน่วยเงินต่างประเทศ</th>
                        <th rowSpan="2">มูลค่า (บาท)</th>
                        <th rowSpan="2">พิกัด</th>
                        <th rowSpan="2">อัตราอากร</th>
                        <th rowSpan="2">ภาษีอากรรวม (บาท)</th>
                        <th rowSpan="2">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        // คำนวณลำดับที่ใหม่ตามการจัดกลุ่ม
                        let rowNumber = i + 1;
                        return (
                          <tr key={r.monthlyDataId ?? i}>
                            <td>{rowNumber}</td>
                            <td>{r.importerNameEN ?? "-"}</td>
                            <td>{fmtThaiDate(r.arrivalDate)}</td>
                            <td>{fmtThaiDate(r.receivedDate)}</td>
                            <td>{r.ctrlDeclarationNo ?? "-"}</td>
                            <td>{r.consignmentCountry ?? "-"}</td>
                            <td>{r.itemNo ?? "-"}</td>
                            <td>{r.description ?? "-"}</td>
                            <td>{r.unit ?? "-"}</td>
                            <td>{r.quantity ?? "-"}</td>
                            <td>{r.netWeight ?? "-"}</td>
                            <td>{r.amount ?? "-"}</td>
                            <td>{r.currency ?? "-"}</td>
                            <td>{r.cifTHB ?? "-"}</td>
                            <td>{r.tariff ? r.tariff.substring(4) : "-"}</td>
                            <td>{r.dutyRate ? `${r.dutyRate}%` : "-"}</td>
                            <td>{r.dutyAmt ?? "-"}</td>
                            <td>{r.remarks ?? "-"}</td>
                          </tr>
                        );
                      })}
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
}
