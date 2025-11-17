import React, { useEffect, useMemo, useRef, useState } from "react";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./UploadMonthly.css";
import * as XLSX from "xlsx";

export default function UploadMonthly() {
  const [fileObj, setFileObj] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [parseError, setParseError] = useState("");
  const [limit] = useState(10);
  const [startSlice, setStartSlice] = useState(0);
  const [countPage, setCountPage] = useState(1);

  const inputRef = useRef(null);
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });

  // ---------------- CSV Parser ----------------
  const parseCSV = (text) => {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);

    console.log("=== CSV PARSER INTERNAL ===");
    console.log("Total lines after split:", lines.length);
    console.log("All lines (full, no truncation):", lines);
    console.log("First 5 lines (detailed):", lines.slice(0, 5).map((line, idx) => ({
      index: idx,
      length: line.length,
      content: line,
      hasCR: line.includes('\r'),
      hasLF: line.includes('\n'),
      first100Chars: line.substring(0, 100)
    })));

    if (lines.length === 0) return { headers: [], rows: [] };

    // Parse full line - used for header only
    const parseFullLine = (line) => {
      const result = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          result.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    };

    // Parse line and extract only essential columns
    // First parse the entire line, then extract only essential columns
    const parseLine = (line, essentialIndices) => {
      if (!essentialIndices || essentialIndices.length === 0) {
        return [];
      }
      
      // First, parse the entire line to get all columns
      const allColumns = [];
      let cur = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          allColumns.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      // Handle the last column
      allColumns.push(cur.trim());
      
      // Now extract only essential columns
      const result = essentialIndices.map(idx => allColumns[idx] ?? "").filter(val => val !== undefined);
      
      return result;
    };

    const headerArr = parseFullLine(lines[0]);
    console.log("Parsed headers:", headerArr);
    console.log("Total header columns:", headerArr.length);
    
    // Define essential columns we want to keep
    const essentialColumns = [
      'Invoice No.',
      'Item No.', //check
      'Importer NameEN', //check
      'Desc.', //check
      'Qty.', //check
      'Unit', //check
      'Netweight', //check
      'Netweight Unit', //check
      'Curr.', //check
      'CIF FOR.', //check
      'CIF THB.', //check
      'Duty Rate', //check
      'Duty Amt.', //check
      'Tariff', //check
      'Ctrl Declaration No.', //check
      'ArrivalDate', //check
      'Consignment Country', //check
    ];
    
    // Find indices of essential columns in the actual headers
    const essentialIndices = essentialColumns.map(col => 
      headerArr.findIndex(h => h && h.toLowerCase().includes(col.toLowerCase()))
    ).filter(idx => idx !== -1);
    
    console.log("Essential indices found:", essentialIndices);
    console.log("Essential columns mapping:", essentialColumns.map((col, i) => ({
      required: col,
      foundAt: essentialIndices[i],
      headerName: essentialIndices[i] >= 0 ? headerArr[essentialIndices[i]] : null
    })));
    
    // Create filtered headers and mapping
    const filteredHeaders = essentialIndices.map(idx => headerArr[idx]);
    
    // Parse all rows - handle multi-line fields properly
    // First, combine lines that are part of multi-line quoted fields
    const body = [];
    let currentRowLines = [];
    let inQuotedField = false;
    
    console.log("=== PARSING ROWS ===");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (i <= 5) {
        console.log(`Row ${i}:`, line.substring(0, 100));
      }
      
      // Count unescaped quotes to determine quote state
      let unescapedQuotes = 0;
      let escaped = false;
      for (let j = 0; j < line.length; j++) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (line[j] === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') {
            escaped = true;
            j++;
          } else {
            unescapedQuotes++;
          }
        }
      }
      
      // If we're building a multi-line row
      if (currentRowLines.length > 0) {
        currentRowLines.push(line);
        // Toggle quote state based on unescaped quotes
        if (unescapedQuotes % 2 === 1) {
          inQuotedField = !inQuotedField;
        }
        
        // If quotes are balanced, we can parse this complete row
        if (!inQuotedField) {
          const fullRow = currentRowLines.join('\n');
          const parsedRow = parseLine(fullRow, essentialIndices);
          if (parsedRow.length === essentialIndices.length) {
            body.push(parsedRow);
          } else {
            console.warn(`Combined row has ${parsedRow.length} columns, expected ${essentialIndices.length}. Skipping.`);
          }
          currentRowLines = [];
        }
      } else {
        // Check if this line has an unclosed quoted field (odd number of unescaped quotes)
        if (unescapedQuotes % 2 === 1) {
          // Odd number of quotes = unclosed quoted field somewhere in the line
          // This means the quoted field spans multiple lines
          currentRowLines.push(line);
          inQuotedField = true;
        } else {
          // Normal complete row - parse it immediately
          const parsedRow = parseLine(line, essentialIndices);
          if (parsedRow.length === essentialIndices.length) {
            body.push(parsedRow);
          } else {
            console.warn(`Row ${i} has ${parsedRow.length} columns, expected ${essentialIndices.length}. Skipping.`);
          }
        }
      }
    }
    
    // Handle any remaining row
    if (currentRowLines.length > 0) {
      const fullRow = currentRowLines.join('\n');
      const parsedRow = parseLine(fullRow, essentialIndices);
      if (parsedRow.length === essentialIndices.length) {
        body.push(parsedRow);
      } else {
        console.warn(`Remaining row has ${parsedRow.length} columns, expected ${essentialIndices.length}. Skipping.`);
      }
    }
    
    console.log("=== PARSED BODY ===");
    console.log("Total parsed rows:", body.length);
    console.log("First 3 parsed rows (raw array):", body.slice(0, 3));
    
    const rowObjs = body.map((arr, rowIndex) => {
      const obj = {};
      
      // arr now contains only essential columns in the same order as filteredHeaders
      filteredHeaders.forEach((header, filteredIdx) => {
        let value = arr[filteredIdx] ?? "";
        
        // Clean the value - remove problematic characters
        if (typeof value === 'string') {
          // Remove control characters and non-printable characters
          value = value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          // Remove replacement characters
          value = value.replace(/[ï¿½�]/g, '');
          // Remove any characters that look like encoding issues
          value = value.replace(/[^\x20-\x7E\u0E00-\u0E7F]/g, '');
        }
        
        // Convert 2-digit year to 4-digit year for date fields
        if (header && header.toLowerCase().includes('date') && typeof value === 'string') {
          // Match patterns like "4/3/25" and convert to "4/3/2025"
          const dateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
          if (dateMatch) {
            const [, month, day, year] = dateMatch;
            const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
            value = `${month}/${day}/${fullYear}`;
          }
        }
        
        obj[header] = value;
      });
      
      return obj;
    });
    return { headers: filteredHeaders, rows: rowObjs };
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    setFileObj(file);
    setParseError("");
    setHeaders([]);
    setRows([]);
    setStartSlice(0);
    setCountPage(1);
  };

  const isZipMagic = async (file) => {
    if (!file) return false;
    const buf = await file.slice(0, 4).arrayBuffer();
    const u8 = new Uint8Array(buf);
    return u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04;
  };

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

      if (isExcel) {
        const ab = await fileObj.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (!aoa || aoa.length === 0) throw new Error("Empty Excel");
        
        console.log("=== EXCEL RAW DATA ===");
        console.log("File name:", fileObj.name);
        console.log("Total rows:", aoa.length);
        console.log("First 5 rows (raw):", aoa.slice(0, 5));
        console.log("Headers (raw):", aoa[0]);
        
        const headerArr = aoa[0].map((h) => String(h || "").trim());
        console.log("Headers (trimmed):", headerArr);
        
        // Define essential columns we want to keep (same as CSV)
        const essentialColumns = [
          'Invoice No.',
          'Item No.',
          'Importer NameEN',
          'Desc.',
          'Qty.',
          'Unit',
          'Netweight',
          'Netweight Unit',
          'Curr.',
          'CIF FOR.',
          'CIF THB.',
          'Duty Rate',
          'Duty Amt.',
          'Tariff',
          'Ctrl Declaration No.',
          'ArrivalDate',
          'Consignment Country',
        ];
        
        // Find indices of essential columns in the actual headers
        const essentialIndices = essentialColumns.map(col => 
          headerArr.findIndex(h => h && h.toLowerCase().includes(col.toLowerCase()))
        ).filter(idx => idx !== -1);
        
        // Create filtered headers
        const filteredHeaders = essentialIndices.map(idx => headerArr[idx]);
        
        const rowsArr = aoa.slice(1);
        const rowObjs = rowsArr.map((r) => {
          const o = {};
          
          essentialIndices.forEach((originalIdx, filteredIdx) => {
            const header = filteredHeaders[filteredIdx];
            let value = r[originalIdx] ?? "";
            
            // Clean the value - remove problematic characters
            if (typeof value === 'string') {
              // Remove control characters and non-printable characters
              value = value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
              // Remove replacement characters
              value = value.replace(/[ï¿½]/g, '');
              // Remove any characters that look like encoding issues
              value = value.replace(/[^\x20-\x7E\u0E00-\u0E7F]/g, '');
            }
            
            // Convert 2-digit year to 4-digit year for date fields
            if (header && header.toLowerCase().includes('date') && typeof value === 'string') {
              // Match patterns like "4/3/25" and convert to "4/3/2025"
              const dateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
              if (dateMatch) {
                const [, month, day, year] = dateMatch;
                const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
                value = `${month}/${day}/${fullYear}`;
              }
            }
            
            o[header] = value;
          });
          
          return o;
        });
        console.log("=== EXCEL PROCESSED DATA ===");
        console.log("Essential indices:", essentialIndices);
        console.log("Filtered headers:", filteredHeaders);
        console.log("Total processed rows:", rowObjs.length);
        console.log("First 3 processed rows:", rowObjs.slice(0, 3));
        
        setHeaders(filteredHeaders);
        setRows(rowObjs);
        setParseError("");
        setStartSlice(0);
        setCountPage(1);
        return;
      }

      if (ext !== "csv") {
        Swal.fire({ title: "Invalid file", text: "Must be .csv or .xlsx", icon: "warning" });
        return;
      }

      const textRaw = await fileObj.text();
      const text = textRaw.replace(/^\uFEFF/, "");
      
      console.log("=== CSV RAW DATA ===");
      console.log("File name:", fileObj.name);
      console.log("Raw text length:", text.length);
      console.log("Full raw text:", text);
      
      // Check for different newline characters
      const hasCRLF = text.includes("\r\n");
      const hasLF = text.includes("\n") && !text.includes("\r\n");
      const hasCR = text.includes("\r") && !text.includes("\r\n");
      console.log("Newline detection:", {
        hasCRLF: hasCRLF,
        hasLF: hasLF,
        hasCR: hasCR,
        CRLF_count: (text.match(/\r\n/g) || []).length,
        LF_count: (text.match(/\n/g) || []).length,
        CR_count: (text.match(/\r/g) || []).length
      });
      
      // Show raw bytes for first few lines
      const firstLines = text.split(/\r\n|\r|\n/).slice(0, 5);
      console.log("First 5 lines (after split):", firstLines);
      firstLines.forEach((line, idx) => {
        console.log(`Line ${idx + 1} raw bytes:`, Array.from(line).map(c => {
          const code = c.charCodeAt(0);
          if (code === 13) return '\\r';
          if (code === 10) return '\\n';
          if (code < 32 || code > 126) return `\\u${code.toString(16).padStart(4, '0')}`;
          return c;
        }).join(''));
      });
      
      const lines = text.split("\n");
      console.log("Total lines after split by \\n:", lines.length);
      console.log("All lines (full):", lines);
      
      const { headers: filteredHeaders, rows: rowObjs } = parseCSV(text);
      
      console.log("=== CSV PROCESSED DATA ===");
      console.log("Filtered headers:", filteredHeaders);
      console.log("Total processed rows:", rowObjs.length);
      console.log("First 3 processed rows:", rowObjs.slice(0, 3));
      
      if (filteredHeaders.length === 0 || rowObjs.length === 0) {
        setParseError("No data found in the CSV file.");
        setHeaders([]);
        setRows([]);
      } else {
        setParseError("");
        setHeaders(filteredHeaders);
        setRows(rowObjs);
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

    Swal.fire({
      title: `Error (${status})`,
      text: msg,
      icon: "error",
      timer: 2500,
      timerProgressBar: true,
    });
  };

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
      const resp = await httpClient.post("/api/master/upload-monthly", payload, authHeaders());

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

  // ---------------- Pagination ----------------
  const totalPage = useMemo(() => Math.max(1, Math.ceil(rows.length / limit)), [rows, limit]);

  useEffect(() => {
    if (countPage > totalPage) {
      setCountPage(1);
      setStartSlice(0);
    }
  }, [rows.length, totalPage, countPage]);

  const Moveright = () => {
    if (countPage < totalPage) {
      setCountPage((p) => p + 1);
      setStartSlice((p) => p + limit);
    }
  };
  const Moveleft = () => {
    if (countPage > 1) {
      setCountPage((p) => p - 1);
      setStartSlice((p) => p - limit);
    }
  };

  const dataAll = useMemo(() => rows.slice(startSlice, startSlice + limit), [rows, startSlice, limit]);

  // ---------------- UI ----------------
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">MASTER</li>
                <li className="breadcrumb-item active">
                  <span className="color-link">UPLOAD MONTHLY DATA</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="card angle gap-margin">
          <div className="card-header card-picking">UPLOAD MONTHLY DATA</div>
          <div className="card-body gap-margin">
            {/* File selector + Upload (for preview) */}
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
                onClick={() => {
                  setParseError("");
                  setHeaders([]);
                  setRows([]);
                  setStartSlice(0);
                  setCountPage(1);
                }}
                disabled={loading || loadingUpload || rows.length === 0}
              >
                Clear Preview
              </button>
            </div>

            {/* Read status */}
            <div className="mt-2">
              {loading && <p>⏳ Reading file...</p>}
              {parseError && <div className="alert alert-warning">{parseError}</div>}
            </div>

            {/* Preview section — match "No Data" style */}
            <div className="table-wrapper csv-preview mt-3" style={{ 
              maxHeight: '400px', 
              overflow: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: '4px'
            }}>
              {rows.length === 0 ? (
                <div className="no-data-cell" style={{ padding: 20, textAlign: "center" }}>
                  📄 No Data
                </div>
              ) : (
                <table className="table table-receive table-custom table-compact" style={{ marginBottom: 0 }}>
                  <colgroup>
                    {headers.map((h, idx) => {
                      // Set specific widths for important columns
                      let width = '120px';
                      if (h && h.toLowerCase().includes('invoice')) width = '120px';
                      else if (h && h.toLowerCase().includes('item')) width = '80px';
                      else if (h && h.toLowerCase().includes('importer')) width = '200px';
                      else if (h && h.toLowerCase().includes('desc') && !h.toLowerCase().includes('th')) width = '150px';
                      else if (h && h.toLowerCase().includes('qty')) width = '80px';
                      else if (h && h.toLowerCase().includes('unit')) width = '60px';
                      else if (h && h.toLowerCase().includes('weight')) width = '100px';
                      else if (h && h.toLowerCase().includes('date')) width = '100px';
                      else if (h && h.toLowerCase().includes('cif')) width = '100px';
                      else if (h && h.toLowerCase().includes('duty')) width = '100px';
                      else if (h && h.toLowerCase().includes('declaration')) width = '150px';
                      else if (h && h.toLowerCase().includes('country')) width = '100px';
                      else if (h && h.toLowerCase().includes('th') || h && h.toLowerCase().includes('thai')) width = '80px';
                      else width = '100px';
                      
                      return <col key={idx} style={{ width }} />;
                    })}
                  </colgroup>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} title={String(h)} style={{ 
                          fontSize: '12px', 
                          padding: '8px 4px',
                          borderBottom: '2px solid #dee2e6',
                          textAlign: 'center'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataAll.map((row, idx) => (
                      <tr key={idx}>
                        {headers.map((h, j) => (
                          <td key={j} title={String(row[h] ?? "")} style={{ 
                            fontSize: '11px',
                            padding: '6px 4px',
                            verticalAlign: 'middle',
                            borderBottom: '1px solid #dee2e6',
                            textAlign: 'center',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
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

            {/* Upload to API */}
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
