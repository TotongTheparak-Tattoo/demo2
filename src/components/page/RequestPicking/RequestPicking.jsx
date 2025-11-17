import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./RequestPicking.css";
import * as XLSX from "xlsx";

const ENDPOINT_UPLOAD_CSV = "/api/v1/requestpicking/uploadcsv"; // API endpoint สำหรับอัปโหลด CSV
const DEFAULT_PAGE_SIZE = 10; // จำนวนรายการต่อหน้า (pagination)

export default function PickingCsvUpload() {
  const [fileObj, setFileObj] = useState(null);  /*ไฟล์ที่เลือก*/
  const [headers, setHeaders] = useState([]);  /*หัวตาราง (columns) ที่อ่านได้จากไฟล์*/
  const [rows, setRows] = useState([]);  /*ข้อมูลแถวทั้งหมดที่อ่านได้จากไฟล์*/
  const [loading, setLoading] = useState(false);  /*สถานะกำลังอ่านไฟล์ (preview)*/
  const [loadingUpload, setLoadingUpload] = useState(false);  /*สถานะกำลังอัปโหลดไปยัง API*/
  const [parseError, setParseError] = useState("");  /*ข้อความ error จากการอ่านไฟล์*/
  const [limit] = useState(DEFAULT_PAGE_SIZE);  /*จำนวนรายการต่อหน้า (pagination)*/
  const [startSlice, setStartSlice] = useState(0);  /*ตำแหน่งเริ่มต้นของ slice สำหรับ pagination*/
  const [countPage, setCountPage] = useState(1);  /*หน้าปัจจุบัน (pagination)*/

  /*Reference สำหรับ input file*/
  const inputRef = useRef(null);
  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });
  // ============================================================================
  // HELPER FUNCTIONS - File Processing
  // ============================================================================
  /*Parse CSV text เป็น headers และ rows*/
  const parseCSV = (text) => {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };
    /*Parse แต่ละบรรทัด โดยรองรับ quoted fields และ escaped quotes*/
    const parseLine = (line) => {
      const result = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            cur += '"'; // Escaped quote
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          result.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      result.push(cur);
      return result.map((x) => x.trim());
    };

    const headerArr = parseLine(lines[0]);
    const body = lines.slice(1).map(parseLine);
    const rowObjs = body.map((arr) => {
      const obj = {};
      headerArr.forEach((h, idx) => {
        obj[h] = arr[idx] ?? "";
      });
      return obj;
    });
    return { headers: headerArr, rows: rowObjs };
  };
  /*ตรวจสอบว่าไฟล์เป็น ZIP/Excel format หรือไม่ (โดยดู magic bytes)*/
  const isZipMagic = async (file) => {
    if (!file) return false;
    const buf = await file.slice(0, 4).arrayBuffer();
    const u8 = new Uint8Array(buf);
    // ZIP magic bytes: PK\x03\x04
    return u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04;
  };
  /*อ่านไฟล์และแสดง preview (รองรับ CSV และ Excel)*/
  const handlePreview = async () => {
    if (!fileObj) {
      Swal.fire({ title: "No file", text: "Please select a file", icon: "info" });
      return;
    }

    try {
      setLoading(true);
      const name = fileObj.name.toLowerCase();
      const ext = name.split(".").pop();

      const looksLikeZip = await isZipMagic(fileObj);
      const isExcel = looksLikeZip || ext === "xlsx" || ext === "xls";

      // จัดการไฟล์ Excel
      if (isExcel) {
        const ab = await fileObj.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (!aoa || aoa.length === 0) throw new Error("Empty Excel");
        const hdr = aoa[0].map((h) => String(h || "").trim());
        const rowsArr = aoa.slice(1);
        const rowObjs = rowsArr.map((r) => {
          const o = {};
          hdr.forEach((h, i) => (o[h] = r[i] ?? ""));
          return o;
        });
        setHeaders(hdr);
        setRows(rowObjs);
        setParseError("");
        setStartSlice(0);
        setCountPage(1);
        return;
      }
      // ตรวจสอบว่าเป็นไฟล์ CSV หรือไม่
      if (ext !== "csv") {
        Swal.fire({ title: "Invalid file", text: "Must be .csv or .xlsx", icon: "warning" });
        return;
      }
      // จัดการไฟล์ CSV
      const textRaw = await fileObj.text();
      const text = textRaw.replace(/^\uFEFF/, ""); // ลบ BOM
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0 || rows.length === 0) {
        setParseError("No data found in the CSV file.");
        setHeaders([]);
        setRows([]);
      } else {
        setParseError("");
        setHeaders(headers);
        setRows(rows);
        setStartSlice(0);
        setCountPage(1);
      }
    } catch (err) {
      console.error(err);
      setParseError("An error occurred while reading the file.");
      setHeaders([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // HELPER FUNCTIONS - Error Handling
  // ============================================================================
  /*แสดง error message ในรูปแบบที่เหมาะสมตาม status code*/
  const showInboundStyleError = (err) => {
    const resp = err?.response;
    if (!resp) {
      Swal.fire({
        title: "Error",
        text: err?.message || "Network/Unexpected error",
        icon: "error",
        timer: 2500,
        timerProgressBar: true,
      });
      return;
    }

    const { status, data } = resp;
    const result = data?.result;
    const msg =
      (typeof result === "string" && result) ||
      result?.message ||
      data?.detail ||
      data?.message ||
      "Request failed";

    // 400, 404, 409, 422 - Validation errors
    if ([400, 404, 409, 422].includes(status)) {
      const missingList = Array.isArray(result?.details)
        ? result.details.map((d) => d?.field || "").filter(Boolean)
        : [];

      const text =
        missingList.length > 0
          ? `${msg}\nMissing: ${missingList.join(", ")}`
          : msg;

      Swal.fire({
        title: "Info!",
        text,
        icon: "info",
        timer: 2500,
        timerProgressBar: true,
      });
      return;
    }

    // 500 - Server error
    if (status === 500) {
      Swal.fire({
        title: "Info!",
        text: msg,
        icon: "info",
        timer: 2000,
        timerProgressBar: true,
      });
      return;
    }

    // Other errors
    Swal.fire({
      title: `Error (${status})`,
      text: msg,
      icon: "error",
      timer: 2500,
      timerProgressBar: true,
    });
  };

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*อัปโหลดข้อมูลไปยัง API*/
  const onUploadToApi = async () => {
    if (rows.length === 0) {
      Swal.fire({
        title: "No data",
        text: "Please select a file and click Upload to preview before sending.",
        icon: "info",
      });
      return;
    }
    try {
      setLoadingUpload(true);
      const payload = {
        filename: fileObj?.name || "upload.csv",
        headers,
        rows,
      };
      const resp = await httpClient.post(ENDPOINT_UPLOAD_CSV, payload, authHeaders());

      switch (resp.status) {
        case 200: {
          Swal.fire({ title: "Upload successful!", icon: "success", timer: 2000, timerProgressBar: true });
          setFileObj(null);
          setHeaders([]);
          setRows([]);
          if (inputRef.current) inputRef.current.value = "";
          break;
        }
        case 500: {
          Swal.fire({
            title: "Info!",
            text: resp.data?.result,
            icon: "info",
            timer: 2000,
            timerProgressBar: true,
          });
          break;
        }
        default: {
          const result = resp.data?.result;
          const msg =
            (typeof result === "string" && result) ||
            result?.message ||
            resp.data?.detail ||
            "Upload failed";
          Swal.fire({
            title: "Info!",
            text: msg,
            icon: "info",
            timer: 2500,
            timerProgressBar: true,
          });
        }
      }
    } catch (err) {
      showInboundStyleError(err);
    } finally {
      setLoadingUpload(false);
    }
  };
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*คำนวณจำนวนหน้าทั้งหมด*/
  const totalPage = useMemo(() => Math.max(1, Math.ceil(rows.length / limit)), [rows, limit]);
  /*ข้อมูลที่แสดงในหน้าปัจจุบัน (pagination)*/
  const dataAll = useMemo(() => rows.slice(startSlice, startSlice + limit), [rows, startSlice, limit]);
  // ============================================================================
  // EFFECTS
  // ============================================================================
  /*ปรับหน้าให้ถูกต้องเมื่อจำนวนข้อมูลเปลี่ยน*/
  useEffect(() => {
    if (countPage > totalPage) {
      setCountPage(1);
      setStartSlice(0);
    }
  }, [rows.length, totalPage, countPage]);
  // ============================================================================
  // EVENT HANDLERS - File Operations
  // ============================================================================
  /*จัดการเมื่อเลือกไฟล์*/
  const onFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    setFileObj(file);
    setParseError("");
    setHeaders([]);
    setRows([]);
    setStartSlice(0);
    setCountPage(1);
  };

  /*ล้าง preview*/
  const onClearPreview = () => {
    setParseError("");
    setHeaders([]);
    setRows([]);
    setStartSlice(0);
    setCountPage(1);
  };

  // ============================================================================
  // EVENT HANDLERS - Pagination
  // ============================================================================
  /*ไปหน้าถัดไป*/
  const Moveright = () => {
    if (countPage < totalPage) {
      setCountPage((p) => p + 1);
      setStartSlice((p) => p + limit);
    }
  };
  /*ไปหน้าก่อนหน้า*/
  const Moveleft = () => {
    if (countPage > 1) {
      setCountPage((p) => p - 1);
      setStartSlice((p) => p - limit);
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
                <li className="breadcrumb-item">OUTBOUND</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">MATERIAL REQUEST LIST</Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="card angle gap-margin">
          <div className="card-header card-picking">UPLOAD CSV</div>
          <div className="card-body gap-margin">
            {/* File Selector and Preview Button */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="form-control angle"
                onChange={onFileChange}
                disabled={loading || loadingUpload}
                style={{ maxWidth: 350 }}
              />
              <button
                className="btn btn-primary angle"
                onClick={handlePreview}
                disabled={!fileObj || loading}
              >
                {loading ? "Reading..." : "Upload"}
              </button>
              <button
                className="btn btn-secondary angle"
                onClick={onClearPreview}
                disabled={loading || loadingUpload || rows.length === 0}
              >
                Clear Preview
              </button>
            </div>

            {/* Read Status */}
            <div className="mt-2">
              {loading && <p>⏳ Reading file...</p>}
              {parseError && <div className="alert alert-warning">{parseError}</div>}
            </div>

            {/* Preview Table */}
            <div className="table-wrapper csv-preview mt-3">
              {rows.length === 0 ? (
                <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                  📄 No Data
                </div>
              ) : (
                <table className="table table-receive table-custom table-compact">
                  <colgroup>{headers.map((_, idx) => <col key={idx} />)}</colgroup>
                  <thead>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} title={String(h)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataAll.map((row, idx) => (
                      <tr key={idx}>
                        {headers.map((h, j) => (
                          <td key={j} title={String(row[h] ?? "")}>
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {rows.length > 0 && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button onClick={Moveleft} className="dropdown-select" style={{ padding: "8px 12px" }}>
                  &lt;&lt;
                </button>
                &nbsp; {countPage}/{totalPage} &nbsp;
                <button onClick={Moveright} className="dropdown-select" style={{ padding: "8px 12px" }}>
                  &gt;&gt;
                </button>
              </div>
            )}

            {/* Upload to API Button */}
            <div className="mt-3" style={{ display: "flex", justifyContent: "flex-start" }}>
              <button
                className="btn btn-info angle"
                disabled={rows.length === 0 || loadingUpload}
                onClick={onUploadToApi}
                style={{ width: 180, height: 40 }}
              >
                {loadingUpload ? "Uploading..." : "Confirm to Upload"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
