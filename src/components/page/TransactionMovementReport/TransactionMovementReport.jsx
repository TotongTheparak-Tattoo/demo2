import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./TransactionMovementReport.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from 'xlsx';

const PAGE_SIZE = 50; // จำนวนรายการต่อหน้า
const ENDPOINT_TRANSACTION_MOVEMENT = "/api/v1/transactionmovement/getdata"; // API endpoint สำหรับดึงข้อมูล transaction movement

export default function TransactionMovementReport() {
  const [page, setPage] = useState(1);  /*หน้าปัจจุบัน (pagination)*/
  const [total, setTotal] = useState(0);  /*จำนวนรายการทั้งหมด*/
  const [rows, setRows] = useState([]);  /*ข้อมูลรายการทั้งหมดในหน้าปัจจุบัน*/
  const [loading, setLoading] = useState(false);  /*สถานะกำลังโหลดข้อมูล*/
  const [ctrlDeclarationNo, setCtrlDeclarationNo] = useState("");  /*เลขที่ใบขนสินค้า (filter)*/
  const [dateFrom, setDateFrom] = useState(() => {  /*วันที่เริ่มต้น (filter) - default เป็นวันนี้*/
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  /*วันที่สิ้นสุด (filter) - default เป็นวันนี้*/
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  /*Reference สำหรับตาราง (ใช้สำหรับ scroll)*/
  const tableRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });
  /*แปลง response จาก API ให้เป็น array ของ rows*/
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
  /*ดึงจำนวน total จาก response*/
  const pluckTotal = (payload) => {
    const n = payload?.data?.count ?? 0;
    return Number(n) || 0;
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
  
  /*แปลงวันที่เป็นรูปแบบ DD/MM/YYYY (ปี พ.ศ.)*/
  const fmtThaiDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    // Convert to Thai Buddhist Era (ปี พ.ศ. = ค.ศ. + 543)
    const thaiYear = d.getFullYear() + 543;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    
    return `${day}/${month}/${thaiYear}`;
  };
  /*แปลง string YYYY-MM-DD เป็น Date object*/
  const ymdToDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /*แปลง Date object เป็น string YYYY-MM-DD*/
  const dateToYMD = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูลจาก API ตามหน้าและ filter*/
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
      const resp = await httpClient.get(ENDPOINT_TRANSACTION_MOVEMENT, { ...authHeaders(), params });
      const data = resp?.data ?? {};
      const list = pluckRows(data);
      const ttl = pluckTotal(data);

      setRows(list);
      setTotal(ttl || list.length);
      setPage(pageNo);
      tableRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[TransactionMovementReport] fetchPage error:", e);
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
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchPage(1, PAGE_SIZE);
  }, [ctrlDeclarationNo, dateFrom, dateTo]);
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*คำนวณจำนวนหน้าทั้งหมด*/
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
  /*ตรวจสอบว่าสามารถไปหน้าก่อนหน้าได้หรือไม่*/
  const canPrev = page > 1;
  /*ตรวจสอบว่าสามารถไปหน้าถัดไปได้หรือไม่*/
  const canNext = page < totalPages;
  // ============================================================================
  // EVENT HANDLERS - Actions
  // ============================================================================
  /*ล้าง filter ทั้งหมด*/
  const onClear = () => {
    setCtrlDeclarationNo("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  /*ไปหน้าก่อนหน้า*/
  const goPrev = () => { if (page > 1) fetchPage(page - 1); };
  /*ไปหน้าถัดไป*/
  const goNext = () => { if (page < totalPages) fetchPage(page + 1); };
  // ============================================================================
  // EVENT HANDLERS - Export Functions
  // ============================================================================
  /*Export ข้อมูลเป็น Excel (คทบ.18 Report)*/
  const exportExcel = () => {
    try {
      /*แปลงวันที่เป็นรูปแบบ DD/MM/YYYY สำหรับแสดงใน report*/
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

      /*=== ส่วนหัวของ Report (Title Rows) ===*/
      const titleRow1 = "คลังสินค้าทัณฑ์บนทั่วไป บริษัท เอ็นเอ็มบี-มินีแบ ไทย จำกัด รหัสคลัง  Wxxxxxxxxxxxxx";
      const titleRow2 = "รายงานการเคลื่อนไหวของของที่นำเข้า  ( Transaction movement Report )";
      const titleRow3 = `ระหว่างวันที่ ${periodFrom} ถึงวันที่ ${periodTo} ( Period : dd/mm/yyyy - dd/mm/yyyy )`;
      const titleRow4 = "รายงานการเคลื่อนไหวของของที่นำเข้า โดยจะดึงมาจากฐานข้อมูลของใบขนสินค้า เพื่อดูรายละเอียดความเคลื่อนไหวของของที่นำเข้าคลังฯ การนำเข้า การนำออก และยอดคงเหลือ โดยจะเรียกข้อมูล  1 ปี เพราะในแต่ละปีเจ้าหน้าที่จะเข้ามาตรวจสอบรายบัญชี และยอดยกมาจากยอดของการปิดบัญชีนำมาเป็นยอดยกมา";
      const titleRow5 = "*รายงานฉบับนี้ให้เรียงลำดับตามวันที่เข้าคลังฯ ลำดับที่ คือ   1 ใบขน และ ในแต่ละใบขนฯจะต้องเรียงรายการข้อมูลรายละเอียดของรายการใบขนฯทุกๆรายการ และจะต้องมียอดรวมขั้นไว้ของแต่ละใบขนฯด้วย";

      /*=== Headers สำหรับตารางรายละเอียด ===*/
      const mainHeaders = [
        "ลำดับที่", "ชื่อผู้นำเข้า", "วันที่นำเข้า", "วันที่นำเข้าคลัง", "เลขที่ใบขนสินค้านำเข้าคลัง",
        "รายการที่", "ชนิดของเป็นภาษาอังกฤษ", "หน่วย", "ยอดยกมา", "", "", "นำเข้า", "", "", "นำออก", "", "", "คงเหลือ", "", ""
      ];
      const subHeaders = [
        "", "", "", "", "", "", "", "", "ปริมาณยกมา", "มูลค่า (บาท)", "ภาษีอากรรวม (บาท)",
        "ปริมาณนำเข้า", "มูลค่า (บาท)", "ภาษีอากรรวม (บาท)", "เลขที่ใบขนสินค้านำออกคลังฯ", "รายการที่", "ปริมาณนำออก",
        "ปริมาณคงเหลือ", "มูลค่า (บาท)", "ภาษีอากรรวม (บาท)"
      ];

      const excelData = [];
      excelData.push(
        [titleRow1, ...new Array(19).fill("")],
        [titleRow2, ...new Array(19).fill("")],
        [titleRow3, ...new Array(19).fill("")],
        [titleRow4, ...new Array(19).fill("")],
        [titleRow5, ...new Array(19).fill("")],
        mainHeaders,
        subHeaders
      );

      /*=== จัดกลุ่มข้อมูลตามชื่อผู้นำเข้า (เรียงตามตัวอักษร) ===*/
      const groupedData = {};
      (rows || []).forEach((r, i) => {
        const importerKey = r.importerNameEN || `unknown_${i}`;
        if (!groupedData[importerKey]) {
          groupedData[importerKey] = [];
        }
        groupedData[importerKey].push({ ...r, originalIndex: i });
      });

      /*=== เพิ่มข้อมูลแบบจัดกลุ่ม (เรียงตามชื่อผู้นำเข้า) ===*/
      let rowNumber = 1;
      Object.keys(groupedData).sort().forEach(importerKey => {
        const items = groupedData[importerKey];
        
        // เพิ่มข้อมูลทั้งหมดก่อน (ไม่แยกตาม unit)
        items.forEach((r, itemIndex) => {
          const isFirstItem = itemIndex === 0;
          const qty = Number(r.quantity) || 0;
          const price = Number(r.cifTHB) || 0;
          const tax = Number(r.dutyAmt) || 0;
          const hasTakeout = itemIndex % 2 === 0;
          const unitForRow = String(r.monthlyUnit || r.unit || '').toUpperCase();
          const takeoutQty = hasTakeout
            ? (unitForRow === 'KGM'
                ? (Number(r.transactionNetWeight) || 0)
                : (Number(r.transactionQuantity) || 0))
            : 0;
          const balanceQty = qty - takeoutQty;
          const balanceValue = price * (balanceQty / qty || 1);
          const balanceTax = tax * (balanceQty / qty || 1);

          const rowData = [
            isFirstItem ? rowNumber : "", // ลำดับที่ (แสดงเฉพาะแถวแรกของแต่ละกลุ่ม)
            isFirstItem ? r.importerNameEN || "" : "", // ชื่อผู้นำเข้า (แสดงเฉพาะแถวแรกของแต่ละกลุ่ม)
            isFirstItem ? fmtThaiDate(r.arrivalDate) : "", // วันที่นำเข้า (ETA) (แสดงเฉพาะแถวแรก)
            isFirstItem ? fmtThaiDate(r.createdAt) : "", // วันที่นำเข้าคลัง (แสดงเฉพาะแถวแรก)
            isFirstItem ? r.declarationNo || "" : "", // เลขที่ใบขนสินค้านำเข้าคลัง (แสดงเฉพาะแถวแรก)
            r.itemNo || itemIndex + 1, // รายการที่ (ใช้ itemNo)
            r.description || "", // ชนิดของเป็นภาษาอังกฤษ (แสดงทุกแถว)
            r.monthlyUnit || r.unit || "KGM", // หน่วย
            0.000, // ปริมาณยกมา
            0.00, // มูลค่า (บาท) ยกมา
            0.00, // ภาษีอากรรวม (บาท) ยกมา
            qty.toFixed(3), // ปริมาณนำเข้า
            price.toFixed(2), // มูลค่า (บาท) นำเข้า
            tax.toFixed(2), // ภาษีอากรรวม (บาท) นำเข้า
            hasTakeout ? (r.ctrlDeclarationNo || "") : "", // เลขที่ใบขนสินค้านำออกคลังฯ
            hasTakeout ? (r.transactionitemNo || r.itemNo || itemIndex + 1) : "", // รายการที่ นำออก
            hasTakeout ? takeoutQty.toFixed(3) : "", // ปริมาณนำออก
            balanceQty.toFixed(3), // ปริมาณคงเหลือ
            balanceValue.toFixed(2), // มูลค่า (บาท) คงเหลือ
            balanceTax.toFixed(2) // ภาษีอากรรวม (บาท) คงเหลือ
          ];
          excelData.push(rowData);
          
          if (isFirstItem) {
            rowNumber++;
          }
        });

        // จัดกลุ่มข้อมูลตาม unit เพื่อสร้างแถวรวม
        const unitGroups = {};
        items.forEach(item => {
          const unit = item.monthlyUnit || item.unit || "";
          if (!unitGroups[unit]) {
            unitGroups[unit] = [];
          }
          unitGroups[unit].push(item);
        });

        // เพิ่มแถว "รวม(TOTAL)" สำหรับแต่ละ unit
        Object.keys(unitGroups).sort().forEach(unit => {
          const unitItems = unitGroups[unit];
          const totalImportQty = unitItems.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
          const totalImportValue = unitItems.reduce((sum, item) => sum + parseFloat(item.cifTHB || 0), 0);
          const totalImportTax = unitItems.reduce((sum, item) => sum + parseFloat(item.dutyAmt || 0), 0);
          const totalTakeoutQty = unitItems.reduce((sum, item) => {
            const hasTakeout = (Number(item.originalIndex) % 2 === 0);
            if (!hasTakeout) return sum;
            const u = String(item.monthlyUnit || item.unit || '').toUpperCase();
            const out = u === 'KGM'
              ? (Number(item.transactionNetWeight) || 0)
              : (Number(item.transactionQuantity) || 0);
            return sum + out;
          }, 0);
          const totalBalanceQty = totalImportQty - totalTakeoutQty;
          const totalBalanceValue = totalImportValue * (totalBalanceQty / totalImportQty || 1);
          const totalBalanceTax = totalImportTax * (totalBalanceQty / totalImportQty || 1);
          
          const totalRow = [
            "", // ลำดับที่
            "", // ชื่อผู้นำเข้า
            "", // วันที่นำเข้า
            "", // วันที่นำเข้าคลัง
            "", // เลขที่ใบขนสินค้านำเข้าคลัง
            "", // รายการที่
            "รวม (TOTAL)", // ชนิดของเป็นภาษาอังกฤษ
            unit, // หน่วย
            0.000, // ปริมาณยกมา
            0.00, // มูลค่า (บาท) ยกมา
            0.00, // ภาษีอากรรวม (บาท) ยกมา
            totalImportQty.toFixed(3), // ปริมาณนำเข้า
            totalImportValue.toFixed(2), // มูลค่า (บาท) นำเข้า
            totalImportTax.toFixed(2), // ภาษีอากรรวม (บาท) นำเข้า
            "", // เลขที่ใบขนสินค้านำออกคลังฯ
            "", // รายการที่ นำออก
            totalTakeoutQty.toFixed(3), // ปริมาณนำออก
            totalBalanceQty.toFixed(3), // ปริมาณคงเหลือ
            totalBalanceValue.toFixed(2), // มูลค่า (บาท) คงเหลือ
            totalBalanceTax.toFixed(2) // ภาษีอากรรวม (บาท) คงเหลือ
          ];
          excelData.push(totalRow);
        });
      });

      /*=== คำนวณ Grand Total สำหรับแต่ละ Unit ===*/
      const allUnits = {};
      (rows || []).forEach(r => {
        const unit = r.monthlyUnit || r.unit || "";
        if (!allUnits[unit]) {
          allUnits[unit] = {
            importQty: 0,
            importValue: 0,
            importTax: 0,
            takeoutQty: 0,
            balanceQty: 0,
            balanceValue: 0,
            balanceTax: 0
          };
        }
        const qty = parseFloat(r.quantity || 0);
        const value = parseFloat(r.cifTHB || 0);
        const tax = parseFloat(r.dutyAmt || 0);
        const unitFlag = String(r.monthlyUnit || r.unit || '').toUpperCase();
        const takeoutQty = unitFlag === 'KGM'
          ? parseFloat(r.transactionNetWeight || 0)
          : parseFloat(r.transactionQuantity || 0);
        const balanceQty = qty - takeoutQty;
        
        allUnits[unit].importQty += qty;
        allUnits[unit].importValue += value;
        allUnits[unit].importTax += tax;
        allUnits[unit].takeoutQty += takeoutQty;
        allUnits[unit].balanceQty += balanceQty;
        allUnits[unit].balanceValue += value * (balanceQty / qty || 1);
        allUnits[unit].balanceTax += tax * (balanceQty / qty || 1);
      });

      // เพิ่มแถว Grand Total สำหรับแต่ละ unit
      Object.keys(allUnits).sort().forEach(unit => {
        const group = allUnits[unit];
        const grandTotalRow = [
          `รวมทั้งหมด (GRAND Total) (${unit})`, // ลำดับที่ (merge กับคอลัมน์อื่น)
          "", // ชื่อผู้นำเข้า
          "", // วันที่นำเข้า
          "", // วันที่นำเข้าคลัง
          "", // เลขที่ใบขนสินค้านำเข้าคลัง
          "", // รายการที่
          "", // ชนิดของเป็นภาษาอังกฤษ
          "", // หน่วย
          0.000, // ปริมาณยกมา
          0.00, // มูลค่า (บาท) ยกมา
          0.00, // ภาษีอากรรวม (บาท) ยกมา
          group.importQty.toFixed(3), // ปริมาณนำเข้า
          group.importValue.toFixed(2), // มูลค่า (บาท) นำเข้า
          group.importTax.toFixed(2), // ภาษีอากรรวม (บาท) นำเข้า
          "", // เลขที่ใบขนสินค้านำออกคลังฯ
          "", // รายการที่ นำออก
          group.takeoutQty.toFixed(3), // ปริมาณนำออก
          group.balanceQty.toFixed(3), // ปริมาณคงเหลือ
          group.balanceValue.toFixed(2), // มูลค่า (บาท) คงเหลือ
          group.balanceTax.toFixed(2) // ภาษีอากรรวม (บาท) คงเหลือ
        ];
        excelData.push(grandTotalRow);
      });

      // เพิ่มแถวสรุปสุดท้าย (Grand Total ทั้งหมด) - รวมยอดจากแถว GRAND Total ของแต่ละ unit
      const grandTotalImportQty = Object.values(allUnits).reduce((sum, group) => sum + group.importQty, 0);
      const grandTotalImportValue = Object.values(allUnits).reduce((sum, group) => sum + group.importValue, 0);
      const grandTotalImportTax = Object.values(allUnits).reduce((sum, group) => sum + group.importTax, 0);
      const grandTotalTakeoutQty = Object.values(allUnits).reduce((sum, group) => sum + group.takeoutQty, 0);
      const grandTotalBalanceQty = Object.values(allUnits).reduce((sum, group) => sum + group.balanceQty, 0);
      const grandTotalBalanceValue = Object.values(allUnits).reduce((sum, group) => sum + group.balanceValue, 0);
      const grandTotalBalanceTax = Object.values(allUnits).reduce((sum, group) => sum + group.balanceTax, 0);
      
      const finalGrandTotalRow = [
        "Grand Total", // ลำดับที่ (merge กับคอลัมน์อื่น)
        "", // ชื่อผู้นำเข้า
        "", // วันที่นำเข้า
        "", // วันที่นำเข้าคลัง
        "", // เลขที่ใบขนสินค้านำเข้าคลัง
        "", // รายการที่
        "", // ชนิดของเป็นภาษาอังกฤษ
        "", // หน่วย
        "", // ปริมาณยกมา (ว่าง)
        "0.00", // มูลค่า (บาท) ยอดยกมา
        "0.00", // ภาษีอากรรวม (บาท) ยอดยกมา
        "", // ปริมาณนำเข้า (ว่าง)
        grandTotalImportValue.toFixed(2), // มูลค่า (บาท) นำเข้า
        grandTotalImportTax.toFixed(2), // ภาษีอากรรวม (บาท) นำเข้า
        "", // เลขที่ใบขนสินค้านำออกคลังฯ (ว่าง)
        "", // รายการที่ นำออก (ว่าง)
        grandTotalTakeoutQty.toFixed(3), // ปริมาณนำออก
        "", // ปริมาณคงเหลือ (ว่าง)
        grandTotalBalanceValue.toFixed(2), // มูลค่า (บาท) คงเหลือ
        grandTotalBalanceTax.toFixed(2) // ภาษีอากรรวม (บาท) คงเหลือ
      ];
      excelData.push(finalGrandTotalRow);

      /*=== ตารางสรุปการนำเข้า/นำออก (Summary Table) - เริ่มที่คอลัมน์ 7 ===*/
      const summaryTableTitle = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "สรุปการนำเข้า / นำออก (Summary Stock in / Stock out)", 
        "", "", "", "", "", "", "", "", "", "", "", "" // คอลัมน์ 8-19 ว่าง
      ];
      excelData.push(summaryTableTitle);

      const summaryTableHeaders = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "รายการ (Item no)", 
        "จำนวน ใบขน (ฉบับ) (Total)", 
        "มูลค่า(บาท) (Summary Declaration Value-BT)", 
        "ภาษีอากรรวม(บาท) (Summary Declaration Duty)",
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(summaryTableHeaders);

      /*=== นับจำนวนใบขนแบบไม่ซ้ำ (unique ctrlDeclarationNo) ตามตำแหน่งที่ 5 ===*/
      /*ตำแหน่งที่ 5 ของ ctrlDeclarationNo แสดงประเภทการเคลื่อนไหว:
        - '0': นำเข้าจากต่างประเทศ
        - '1': ส่งออกต่างประเทศ
        - 'B', 'D': โอนย้าย
        - 'P': ชำระภาษี
        - 'C', 'A': รับโอน
      */
      const beginningBalanceSet = new Set();
      const importSet = new Set();
      const domesticTransferSet = new Set();
      const exportSet = new Set();
      const transferSet = new Set();
      const payDutySet = new Set();

      (rows || []).forEach(r => {
        const rawCtrl = r.ctrlDeclarationNo || "";
        const ctrlDeclarationNo = rawCtrl.trim().toUpperCase().replace(/\s+/g, "");
        if (ctrlDeclarationNo.length >= 5) {
          const fifthChar = ctrlDeclarationNo.charAt(4);
          switch (fifthChar) {
            case '0': // นำเข้าจากต่างประเทศ
              importSet.add(ctrlDeclarationNo);
              break;
            case '1': // ส่งออกต่างประเทศ
              exportSet.add(ctrlDeclarationNo);
              break;
            case 'B':
            case 'D': // โอนย้าย
              transferSet.add(ctrlDeclarationNo);
              break;
            case 'P': // ชำระภาษี
              payDutySet.add(ctrlDeclarationNo);
              break;
            case 'C':
            case 'A': // รับโอน
              domesticTransferSet.add(ctrlDeclarationNo);
              break;
          }
        }
      });

      const beginningBalanceCount = beginningBalanceSet.size;
      const importCount = importSet.size;
      const domesticTransferCount = domesticTransferSet.size;
      const exportCount = exportSet.size;
      const payDutyCount = payDutySet.size;

      // ยอดยกมา
      const beginningBalanceRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "ยอดยกมา (Beginning Balance)",
        beginningBalanceCount.toString(), // จำนวนใบขน
        "0.00", // มูลค่า (จาก Grand Total ยอดยกมา)
        "0.00", // ภาษีอากร (จาก Grand Total ยอดยกมา)
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(beginningBalanceRow);

      // คำนวณมูลค่าและภาษีอากรของ นำเข้าจากต่างประเทศ (ใช้ declarationNo ตำแหน่งที่ 5 = '0')
      let importFromOverseaValue = 0;
      let importFromOverseaTax = 0;
      (rows || []).forEach(r => {
        const declNo = (r.ctrlDeclarationNo || "").trim().toUpperCase();
        if (declNo.length >= 5 && declNo.charAt(4) === '0') {
          const qty = parseFloat(r.quantity || 0);
          const importValue = parseFloat(r.cifTHB || 0);
          const importTax = parseFloat(r.dutyAmt || 0);
          const unitFlag = String(r.monthlyUnit || r.unit || '').toUpperCase();
          const takeoutQty = unitFlag === 'KGM'
            ? parseFloat(r.transactionNetWeight || 0)
            : parseFloat(r.transactionQuantity || 0);
          const balanceQty = Math.max(0, qty - takeoutQty);
          const balanceValue = qty ? importValue * (balanceQty / qty) : 0;
          const balanceTax = qty ? importTax * (balanceQty / qty) : 0;
          importFromOverseaValue += (importValue - balanceValue);
          importFromOverseaTax += (importTax - balanceTax);
        }
      });
      // นำเข้าจากต่างประเทศ
      const importRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "นำเข้าจากต่างประเทศ (Import fro)",
        importCount.toString(), // จำนวนใบขน (unique ctrlDeclarationNo ที่ขึ้นต้นด้วยตัวที่ 5 = '0')
        importFromOverseaValue.toFixed(2), // มูลค่า (Σ นำเข้า - คงเหลือ เมื่อ ctrlNo[4] == '0')
        importFromOverseaTax.toFixed(2), // ภาษีอากร (Σ ภาษีนำเข้า - ภาษีคงเหลือ เมื่อ ctrlNo[4] == '0')
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(importRow);

      // คำนวณมูลค่าและภาษีอากรของรับโอน
      let domesticTransferValue = 0;
      let domesticTransferTax = 0;
      
      (rows || []).forEach(r => {
        // ตรวจสอบเลขที่ใบขนสินค้านำออกคลังฯ ตำแหน่งที่ 5
        const declarationNo = r.ctrlDeclarationNo || "";
        if (declarationNo.length >= 5 && (declarationNo.charAt(4) === 'C' || declarationNo.charAt(4) === 'A')) {
          const qty = parseFloat(r.quantity || 0);
          const importValue = parseFloat(r.cifTHB || 0);
          const importTax = parseFloat(r.dutyAmt || 0);
          const unitFlag = String(r.monthlyUnit || r.unit || '').toUpperCase();
          const takeoutQty = unitFlag === 'KGM'
            ? parseFloat(r.transactionNetWeight || 0)
            : parseFloat(r.transactionQuantity || 0);
          const balanceQty = Math.max(0, qty - takeoutQty);
          const balanceValue = qty ? importValue * (balanceQty / qty) : 0;
          const balanceTax = qty ? importTax * (balanceQty / qty) : 0;
          domesticTransferValue += (importValue - balanceValue);
          domesticTransferTax += (importTax - balanceTax);
        }
      });

      // รับโอน
      const domesticTransferRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "รับโอน (Domestic transfer entry)",
        domesticTransferCount > 0 ? domesticTransferCount.toString() : "-", // จำนวนใบขน
        domesticTransferCount > 0 ? domesticTransferValue.toFixed(2) : "-", // มูลค่า
        domesticTransferCount > 0 ? domesticTransferTax.toFixed(2) : "-", // ภาษีอากร
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(domesticTransferRow);

      // คำนวณมูลค่าและภาษีอากรของส่งออกต่างประเทศ
      let exportValue = 0;
      let exportTax = 0;
      
      (rows || []).forEach(r => {
        // ตรวจสอบเลขที่ใบขนสินค้านำออกคลังฯ ตำแหน่งที่ 5
        const declarationNo = r.ctrlDeclarationNo || "";
        if (declarationNo.length >= 5 && declarationNo.charAt(4) === '1') {
          const qty = parseFloat(r.quantity || 0);
          const importValue = parseFloat(r.cifTHB || 0);
          const importTax = parseFloat(r.dutyAmt || 0);
          const unitFlag = String(r.monthlyUnit || r.unit || '').toUpperCase();
          const takeoutQty = unitFlag === 'KGM'
            ? parseFloat(r.transactionNetWeight || 0)
            : parseFloat(r.transactionQuantity || 0);
          const balanceQty = Math.max(0, qty - takeoutQty);
          const balanceValue = qty ? importValue * (balanceQty / qty) : 0;
          const balanceTax = qty ? importTax * (balanceQty / qty) : 0;
          exportValue += (importValue - balanceValue);
          exportTax += (importTax - balanceTax);
        }
      });

      // ส่งออกต่างประเทศ
      const exportRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "ส่งออกต่างประเทศ (Export)",
        exportCount.toString(), // จำนวนใบขน
        exportValue.toFixed(2), // มูลค่า
        exportTax.toFixed(2), // ภาษีอากร
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(exportRow);

      // คำนวณมูลค่าและภาษีอากรของโอนย้าย
      let transferValue = 0;
      let transferTax = 0;
      let transferCount = 0;
      
      (rows || []).forEach(r => {
        // ตรวจสอบเลขที่ใบขนสินค้านำออกคลังฯ ตำแหน่งที่ 5
        const declarationNo = r.ctrlDeclarationNo || "";
        if (declarationNo.length >= 5 && (declarationNo.charAt(4) === 'B' || declarationNo.charAt(4) === 'D')) {
          const qty = parseFloat(r.quantity || 0);
          const importValue = parseFloat(r.cifTHB || 0);
          const importTax = parseFloat(r.dutyAmt || 0);
          const unitFlag = String(r.monthlyUnit || r.unit || '').toUpperCase();
          const takeoutQty = unitFlag === 'KGM'
            ? parseFloat(r.transactionNetWeight || 0)
            : parseFloat(r.transactionQuantity || 0);
          const balanceQty = Math.max(0, qty - takeoutQty);
          const balanceValue = qty ? importValue * (balanceQty / qty) : 0;
          const balanceTax = qty ? importTax * (balanceQty / qty) : 0;
          transferValue += (importValue - balanceValue);
          transferTax += (importTax - balanceTax);
          transferCount++;
        }
      });

      // โอนย้าย
      const domesticTransferOutRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "โอนย้าย (Domestic Transfer en)",
        transferSet.size.toString(), // จำนวนใบขน (unique)
        transferValue.toFixed(2), // มูลค่า
        transferTax.toFixed(2), // ภาษีอากร
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(domesticTransferOutRow);

      // คำนวณมูลค่าและภาษีอากรของชำระภาษี
      let payDutyValue = 0;
      let payDutyTax = 0;
      
      (rows || []).forEach(r => {
        // ตรวจสอบเลขที่ใบขนสินค้านำออกคลังฯ ตำแหน่งที่ 5
        const declarationNo = r.ctrlDeclarationNo || "";
        if (declarationNo.length >= 5 && declarationNo.charAt(4) === 'P') {
          const qty = parseFloat(r.quantity || 0);
          const importValue = parseFloat(r.cifTHB || 0);
          const importTax = parseFloat(r.dutyAmt || 0);
          const unitFlag = String(r.monthlyUnit || r.unit || '').toUpperCase();
          const takeoutQty = unitFlag === 'KGM'
            ? parseFloat(r.transactionNetWeight || 0)
            : parseFloat(r.transactionQuantity || 0);
          const balanceQty = Math.max(0, qty - takeoutQty);
          const balanceValue = qty ? importValue * (balanceQty / qty) : 0;
          const balanceTax = qty ? importTax * (balanceQty / qty) : 0;
          payDutyValue += (importValue - balanceValue);
          payDutyTax += (importTax - balanceTax);
        }
      });

      // ชำระภาษี
      const payDutyRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "ชำระภาษี (Pay Duty)",
        payDutyCount.toString(), // จำนวนใบขน
        payDutyValue.toFixed(2), // มูลค่า
        payDutyTax.toFixed(2), // ภาษีอากร
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(payDutyRow);

      // อื่นๆ
      const otherRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "อื่นๆ (Other)",
        "-", // จำนวนใบขน
        "-", // มูลค่า
        "-", // ภาษีอากร
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(otherRow);

      // Summary Row 1 (Stock In Total)
      const stockInTotalRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "", // รายการ
        "", // จำนวนใบขน
        importFromOverseaValue.toFixed(2), // มูลค่ารวม (ยอดยกมา(0) + นำเข้าจากต่างประเทศ)
        importFromOverseaTax.toFixed(2), // ภาษีอากรรวม (ยอดยกมา(0) + นำเข้าจากต่างประเทศ)
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(stockInTotalRow);

      // Summary Row 2 (Stock Out Total)
      const stockOutTotalRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "", // รายการ
        "", // จำนวนใบขน
        (exportValue + transferValue + payDutyValue).toFixed(2), // มูลค่ารวม (ส่งออก + โอนย้าย + ชำระภาษี)
        (exportTax + transferTax + payDutyTax).toFixed(2), // ภาษีอากรรวม (ส่งออก + โอนย้าย + ชำระภาษี)
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(stockOutTotalRow);

      // Cross Check Row
      const stockInTotal = importFromOverseaValue; // ยอดยกมา(0) + นำเข้าจากต่างประเทศ
      const stockOutTotal = exportValue + transferValue + payDutyValue; // ส่งออก + โอนย้าย + ชำระภาษี
      const stockInTaxTotal = importFromOverseaTax; // ยอดยกมา(0) + นำเข้าจากต่างประเทศ
      const stockOutTaxTotal = exportTax + transferTax + payDutyTax; // ส่งออก + โอนย้าย + ชำระภาษี
      
      const crossCheckRow = [
        "", "", "", "", "", "", "", // คอลัมน์ 0-6 ว่าง
        "Cross check ยอด(1+2+3)-(4-5-6-7-8)", // รายการ
        "", // จำนวนใบขน
        (stockInTotal - stockOutTotal).toFixed(2), // มูลค่าคงเหลือ (Stock In - Stock Out)
        (stockInTaxTotal - stockOutTaxTotal).toFixed(2), // ภาษีอากรรวมคงเหลือ (Stock In - Stock Out)
        "", "", "", "", "", "", "", "", "" // คอลัมน์ 12-19 ว่าง
      ];
      excelData.push(crossCheckRow);

      /*=== สร้าง Excel Workbook และ Worksheet ===*/
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      /*=== Merge cells สำหรับ Title Rows ===*/
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 19 } }); // Title Row 1
      ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 19 } }); // Title Row 2
      ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 19 } }); // Title Row 3
      ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 19 } }); // Title Row 4
      ws['!merges'].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 19 } }); // Title Row 5
      
      // หาแถวของหัวข้อตารางสรุป
      const summaryTitleRowIndex = excelData.findIndex(row => 
        row[7] === "สรุปการนำเข้า / นำออก (Summary Stock in / Stock out)"
      );
      
      if (summaryTitleRowIndex !== -1) {
        // Merge คอลัมน์ 7-10 สำหรับหัวข้อตารางสรุป (คอลัมน์ 7-10 = รายการ, จำนวนใบขน, มูลค่า, ภาษีอากร)
        ws['!merges'].push({ s: { r: summaryTitleRowIndex, c: 7 }, e: { r: summaryTitleRowIndex, c: 10 } });
        
        // ตั้งค่า style สำหรับหัวข้อตารางสรุป
        for (let c = 7; c <= 10; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: summaryTitleRowIndex, c });
          const isFirst = c === 7;
          if (!ws[cellRef]) ws[cellRef] = { v: isFirst ? "สรุปการนำเข้า / นำออก (Summary Stock in / Stock out)" : "" };
          else if (isFirst) ws[cellRef].v = "สรุปการนำเข้า / นำออก (Summary Stock in / Stock out)";
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
      
      // Merge header cells สำหรับ main headers (แถว mainHeaders = index 5 เมื่อมี title 5 แถว)
      ws['!merges'].push({ s: { r: 5, c: 8 }, e: { r: 5, c: 10 } }); // ยอดยกมา (Beginning Balance)
      ws['!merges'].push({ s: { r: 5, c: 11 }, e: { r: 5, c: 13 } }); // นำเข้า (IMPORT)
      ws['!merges'].push({ s: { r: 5, c: 14 }, e: { r: 5, c: 16 } }); // นำออก (TAKE OUT)
      ws['!merges'].push({ s: { r: 5, c: 17 }, e: { r: 5, c: 19 } }); // คงเหลือ (Balance)
      
      // ตั้งค่า style สำหรับ header ที่ merge
      const headerMergeCells = [
        { start: 8, end: 10, text: "ยอดยกมา" },
        { start: 11, end: 13, text: "นำเข้า" },
        { start: 14, end: 16, text: "นำออก" },
        { start: 17, end: 19, text: "คงเหลือ" }
      ];
      
      headerMergeCells.forEach(({ start, end, text }) => {
        for (let c = start; c <= end; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: 5, c });
          const isFirst = c === start;
          if (!ws[cellRef]) ws[cellRef] = { v: isFirst ? text : "" };
          else if (isFirst) ws[cellRef].v = text;
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
      });

      // ตั้งค่า merge cells และ alignment สำหรับคอลัมน์ที่ต้อง merge
      const headerOffset = 7; // รวม header rows (title 5 แถว + main headers + sub headers)
      let currentRow = headerOffset; // เริ่มหลังจาก header
      
      // คอลัมน์ที่ต้อง merge (index เริ่มจาก 0)
      const columnsToMerge = [
        0, // ลำดับที่ (NO)
        1, // ชื่อผู้นำเข้า (Importer Name)
        2, // วันที่นำเข้า (ETA)
        3, // วันที่นำเข้าคลังฯ (Stock In Date)
        4  // เลขที่ใบขนสินค้า นำเข้าคลังฯ (Import Entry number)
      ];
      
      Object.keys(groupedData).sort().forEach(importerKey => {
        const items = groupedData[importerKey];
        if (items.length > 0) {
          // จัดกลุ่มข้อมูลตาม unit
          const unitGroups = {};
          items.forEach(item => {
            const unit = item.monthlyUnit || item.unit || "";
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

          // Merge เฉพาะแถว "รวม (TOTAL)" - รวมคอลัมน์ 5-6 (Entry SEQ และ Description)
          // สำหรับแต่ละแถวรวมตาม unit
          for (let i = 0; i < totalSummaryRows; i++) {
            const totalRowIndex = currentRow + dataRowsForThisGroup + i;
            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: totalRowIndex, c: 5 }, e: { r: totalRowIndex, c: 6 } });
            
            // ตั้งค่า style สำหรับแถวรวม
            for (let c = 5; c <= 6; c++) {
              const cellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c });
              const isLeft = c === 5;
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
          const unit = item.monthlyUnit || item.unit || "";
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
      
      // Merge คอลัมน์ 0-6 สำหรับแถว Grand Total
      for (let row = grandTotalStartRow; row <= grandTotalEndRow; row++) {
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: 6 } });
        
        // ไม่ merge คอลัมน์คงเหลือสำหรับแถว Grand Total
        
        // ตั้งค่า style สำหรับแถว Grand Total
        for (let c = 0; c <= 6; c++) {
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
        
        // ตั้งค่า style สำหรับคอลัมน์คงเหลือในแถวสุดท้าย (ไม่ merge)
        if (row === grandTotalEndRow) {
          for (let c = 17; c <= 19; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c });
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
      }

      /*=== ตั้งค่าความกว้างของคอลัมน์ ===*/
      ws['!cols'] = [
        { wch: 8 }, // ลำดับที่
        { wch: 20 }, // ชื่อผู้นำเข้า
        { wch: 12 }, // วันที่นำเข้า
        { wch: 12 }, // วันที่นำเข้าคลัง
        { wch: 18 }, // เลขที่ใบขนสินค้านำเข้าคลัง
        { wch: 8 }, // รายการที่
        { wch: 25 }, // ชนิดของเป็นภาษาอังกฤษ
        { wch: 8 }, // หน่วย
        { wch: 12 }, // ปริมาณยกมา
        { wch: 12 }, // มูลค่า (บาท) ยกมา
        { wch: 12 }, // ภาษีอากรรวม (บาท) ยกมา
        { wch: 12 }, // ปริมาณนำเข้า
        { wch: 12 }, // มูลค่า (บาท) นำเข้า
        { wch: 12 }, // ภาษีอากรรวม (บาท) นำเข้า
        { wch: 18 }, // เลขที่ใบขนสินค้านำออกคลังฯ
        { wch: 8 }, // รายการที่ นำออก
        { wch: 12 }, // ปริมาณนำออก
        { wch: 12 }, // ปริมาณคงเหลือ
        { wch: 12 }, // มูลค่า (บาท) คงเหลือ
        { wch: 12 }  // ภาษีอากรรวม (บาท) คงเหลือ
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Transaction Movement Report");
      XLSX.writeFile(wb, `คทบ.18_report.xlsx`);
      
      Swal.fire({
        title: "Export Successful!",
        text: "Transaction Movement Report exported successfully",
        icon: "success",
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error("Export error:", err);
      Swal.fire({
        title: "Export Error",
        text: "Failed to export report",
        icon: "error",
        timer: 2000,
        timerProgressBar: true,
      });
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
                <li className="breadcrumb-item">REPORT</li>
                <li className="breadcrumb-item">
                  <Link to="/vmi-report-menu" className="color-link">Logistics Report</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">คทบ.18 Report</Link>
                </li>
              </ol>
            </div>
          </div>

          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              คทบ.18 Report
            </div>

            <div className="card-body gap-margin">
              {/* Filters and Controls */}
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
                  <table className="table table-receive table-custom table-compact table-wide">
                    <colgroup>
                      <col className="col-tm-no" />
                      <col className="col-tm-importer" />
                      <col className="col-tm-eta" />
                      <col className="col-tm-stockin" />
                      <col className="col-tm-entry" />
                      <col className="col-tm-item" />
                      <col className="col-tm-desc" />
                      <col className="col-tm-unit" />
                      <col className="col-tm-begin-qty" />
                      <col className="col-tm-begin-value" />
                      <col className="col-tm-begin-tax" />
                      <col className="col-tm-import-qty" />
                      <col className="col-tm-import-value" />
                      <col className="col-tm-import-tax" />
                      <col className="col-tm-takeout-entry" />
                      <col className="col-tm-takeout-seq" />
                      <col className="col-tm-takeout-qty" />
                      <col className="col-tm-balance-qty" />
                      <col className="col-tm-balance-value" />
                      <col className="col-tm-balance-tax" />
                    </colgroup>
                    <thead className="text-center">
                      <tr>
                        <th rowSpan="2">ลำดับที่ (NO)</th>
                        <th rowSpan="2">ชื่อผู้นำเข้า (Importer Name)</th>
                        <th rowSpan="2">วันที่นำเข้า (ETA)</th>
                        <th rowSpan="2">วันที่นำเข้าคลังฯ (Stock In Date)</th>
                        <th rowSpan="2">เลขที่ใบขนสินค้า นำเข้าคลังฯ (Import Entry number)</th>
                        <th rowSpan="2">รายการที่ (Entry SEQ)</th>
                        <th rowSpan="2">ชนิดของเป็นภาษาอังกฤษ (Description-English)</th>
                        <th rowSpan="2">หน่วย (Unit)</th>
                        <th colSpan="3">ยอดยกมา (Beginning Balance)</th>
                        <th colSpan="3">นำเข้า (IMPORT)</th>
                        <th colSpan="3">นำออก (TAKE OUT)</th>
                        <th colSpan="3">คงเหลือ (Balance)</th>
                      </tr>
                      <tr>
                        <th>ปริมาณยกมา</th>
                        <th>มูลค่า (บาท)</th>
                        <th>ภาษีอากรรวม (บาท)</th>
                        <th>ปริมาณนำเข้า</th>
                        <th>มูลค่า (บาท)</th>
                        <th>ภาษีอากรรวม (บาท)</th>
                        <th>เลขที่ใบขนสินค้านำออกคลังฯ</th>
                        <th>รายการที่</th>
                        <th>ปริมาณนำออก</th>
                        <th>ปริมาณคงเหลือ</th>
                        <th>มูลค่า (บาท)</th>
                        <th>ภาษีอากรรวม (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.monthlyDataId ?? i}>
                          <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                          <td>{r.importerNameEN || `ผู้นำเข้า ${i + 1}`}</td>
                          <td>{fmtThaiDate(r.arrivalDate)}</td>
                          <td>{fmtThaiDate(r.receivedDate)}</td>
                          <td>{r.declarationNo || `A${String(i + 1).padStart(3, '0')}`}</td>
                          <td>{r.itemNo || (i + 1)}</td>
                          <td>{r.description || `สินค้า ${String.fromCharCode(65 + i)}`}</td>
                          <td>{r.monthlyUnit || ''}</td>
                          <td>0.000</td>
                          <td>0.00</td>
                          <td>0.00</td>
                          <td>{r.quantity ? Number(r.quantity).toFixed(3) : '0.000'}</td>
                          <td>{r.cifTHB ? Number(r.cifTHB).toFixed(2) : '0.00'}</td>
                          <td>{r.dutyAmt ? Number(r.dutyAmt).toFixed(2) : '0.00'}</td>
                          <td>{i % 2 === 0 ? r.ctrlDeclarationNo : ''}</td>
                          <td>{i % 2 === 0 ? r.transactionitemNo : ''}</td>
                          <td>{i % 2 === 0
                            ? (() => {
                                const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                                const value = unit === 'KGM'
                                  ? r.transactionNetWeight
                                  : unit === 'C62'
                                    ? r.transactionQuantity
                                    : r.transactionQuantity;
                                return value != null ? Number(value).toFixed(3) : '';
                              })()
                            : ''}
                          </td>
                          <td>{i % 2 === 0
                            ? (() => {
                                const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                                const takeout = unit === 'KGM'
                                  ? (Number(r.transactionNetWeight) || 0)
                                  : (Number(r.transactionQuantity) || 0);
                                return r.quantity ? (Number(r.quantity) - takeout).toFixed(3) : '0.000';
                              })()
                            : (r.quantity ? Number(r.quantity).toFixed(3) : '0.000')}
                          </td>
                          <td>{(r.cifTHB && r.quantity)
                            ? (() => {
                                const unit = String(r.monthlyUnit || r.unit || '').toUpperCase();
                                const takeout = unit === 'KGM'
                                  ? (Number(r.transactionNetWeight) || 0)
                                  : (Number(r.transactionQuantity) || 0);
                                const qty = Number(r.quantity) || 0;
                                const balance = i % 2 === 0 ? Math.max(0, qty - takeout) : qty;
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
                                const balance = i % 2 === 0 ? Math.max(0, qty - takeout) : qty;
                                return ((Number(r.dutyAmt) / (qty || 1)) * balance).toFixed(2);
                              })()
                            : '0.00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination and Total Count */}
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