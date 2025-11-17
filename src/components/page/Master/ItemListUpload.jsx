import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import Swal from "sweetalert2";
import "./ItemListUpload.css";
import * as XLSX from "xlsx";

export default function ItemListUpload() {
  // ====== Config ======
  const endpointUpload = "/api/v1/itemlist/upload";
  const REQUIRED_HEADERS = [
    "Zone",
    "Vendor Code",
    "Vendor Name",
    "Manufacture",
    "Spec",
    "Dia",
    "Length",
    "Size",
    "L",
    "W",
    "H",
    "Weight",
    "Sub location",
  ];
  const NUMERIC_HEADERS = ["Dia", "Length", "L", "W", "H", "Weight"];

  // ====== State ======
  const [fileObj, setFileObj] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [parseError, setParseError] = useState("");
  const [unknownHeaders, setUnknownHeaders] = useState([]);
  const [missingHeaders, setMissingHeaders] = useState([]);

  // Preview pagination
  const [limit] = useState(10);
  const [startSlice, setStartSlice] = useState(0);
  const [countPage, setCountPage] = useState(1);

  const inputRef = useRef(null);
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });

  // ====== Utils ======
  const norm = (s = "") => String(s).toLowerCase().replace(/[\s_\-().]/g, "");
  const aliasMap = {
    Zone: ["zone"],
    "Vendor Code": ["vendorcode", "vendorco", "vendorcd", "vendercode", "code"],
    "Vendor Name": ["vendorname", "vendornm", "vendorna", "vendername", "name", "vendor"],
    Manufacture: ["manufacture", "manufacturer", "mfr", "maker", "brand", "manufactu"],
    Spec: ["spec", "specification", "grade", "specs"],
    Dia: ["dia", "diameter", "ø", "phi"],
    Length: ["length", "len", "lngth"],
    Size: ["size"],
    L: ["l"],
    W: ["w", "width"],
    H: ["h", "height"],
    Weight: ["weight", "wt", "kg", "mass"],
    "Sub location": ["sublocation", "subloc", "sub_loc", "sub-loc", "sub location", "subbay", "sub bay"],
  };

  const mapHeaderToStandard = (h) => {
    const n = norm(h);
    for (const std of REQUIRED_HEADERS) {
      if (norm(std) === n) return std;
    }
    for (const std of REQUIRED_HEADERS) {
      const aliases = aliasMap[std] || [];
      for (const a of [std, ...aliases]) {
        const na = norm(a);
        if (n === na || n.startsWith(na) || na.startsWith(n)) return std;
      }
    }
    return null;
  };

  const coerceNumber = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/\s/g, "");
    // try 1,234.56 style
    let x = Number(s.replace(/,/g, ""));
    if (!Number.isNaN(x)) return s === "" ? "" : x;
    // try 1 234,56 style
    x = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(x) ? String(v) : x;
  };

  const buildStandardRows = (rawHeaderArr, rawRows) => {
    // build mapping: rawHeader -> standardHeader
    const colMap = {};
    const seenStd = new Set();
    const unknown = [];

    rawHeaderArr.forEach((h) => {
      const std = mapHeaderToStandard(h);
      if (std && !seenStd.has(std)) {
        colMap[h] = std;
        seenStd.add(std);
      } else if (!std) {
        unknown.push(h);
      }
    });

    const missing = REQUIRED_HEADERS.filter((h) => ![...seenStd].includes(h));
    setUnknownHeaders(unknown);
    setMissingHeaders(missing);
    const standardized = rawRows.map((r) => {
      const o = {};
      REQUIRED_HEADERS.forEach((stdKey) => {
        const rawKey = Object.keys(colMap).find((k) => colMap[k] === stdKey);
        const v = rawKey ? r[rawKey] : "";
        o[stdKey] = NUMERIC_HEADERS.includes(stdKey) ? coerceNumber(v) : v ?? "";
      });
      return o;
    });

    return standardized;
  };

  // ====== CSV/Excel Reader ======
  const parseCSV = (text) => {
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line) => {
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

  const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFileObj(file);
    setParseError("");
    setHeaders([]);
    setRows([]);
    setUnknownHeaders([]);
    setMissingHeaders([]);
    setStartSlice(0);
    setCountPage(1);
  };

  const isZipMagic = async (file) => {
    if (!file) return false;
    const buf = await file.slice(0, 4).arrayBuffer();
    const u8 = new Uint8Array(buf);
    return u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04; // PK..
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (!aoa || aoa.length === 0) throw new Error("Empty Excel");

        const rawHeaders = aoa[0].map((h) => String(h || "").trim());
        const rawRows = aoa.slice(1).map((row) => {
          const o = {};
          rawHeaders.forEach((h, i) => (o[h] = row[i] ?? ""));
          return o;
        });

        const stdRows = buildStandardRows(rawHeaders, rawRows);
        setHeaders(REQUIRED_HEADERS);
        setRows(stdRows);
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
      const { headers: rawHeaders, rows: rawRows } = parseCSV(text);
      if (rawHeaders.length === 0 || rawRows.length === 0) {
        setParseError("No data found in the file.");
        setHeaders([]);
        setRows([]);
      } else {
        const stdRows = buildStandardRows(rawHeaders, rawRows);
        setHeaders(REQUIRED_HEADERS);
        setRows(stdRows);
        setParseError("");
        setStartSlice(0);
        setCountPage(1);
      }
    } catch (err) {
      console.error(err);
      setParseError("An error occurred while reading the file.");
      setHeaders([]);
      setRows([]);
      setUnknownHeaders([]);
      setMissingHeaders([]);
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
        missingList.length > 0 ? `${msg}\nMissing: ${missingList.join(", ")}` : msg;
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
    // Check required columns on click only
    if (missingHeaders.length > 0) {
      Swal.fire({
        title: "Info!",
        text: `Missing required columns: ${missingHeaders.join(", ")}`,
        icon: "info",
        timer: 2500,
        timerProgressBar: true,
      });
      return;
    }
    try {
      setLoadingUpload(true);
      const payload = {
        filename: fileObj?.name || "itemlist.csv",
        headers: REQUIRED_HEADERS,
        rows,
      };
      const resp = await httpClient.post(endpointUpload, payload, authHeaders());
      if (resp.status === 200 || resp.status === 201) {
        const { totalReceived, success, skip /*, duplicateInFile, duplicateInDb*/ } = resp.data.result;
        Swal.fire({
          title: "Upload summary",
          html: `
            Total: <b>${totalReceived}</b><br/>
            Success: <b>${success}</b><br/>
            Skip: <b>${skip}</b>
          `,
          // (in-file / in-db breakdown available from response if you want to show)
          icon: "success",
          timer: 1500,
        });
        setFileObj(null);
        setHeaders([]);
        setRows([]);
        setUnknownHeaders([]);
        setMissingHeaders([]);
        if (inputRef.current) inputRef.current.value = "";
      } else {
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
    } catch (err) {
      showInboundStyleError(err);
    } finally {
      setLoadingUpload(false);
    }
  };

  // ====== Pagination ======
  const totalPage = useMemo(
    () => Math.max(1, Math.ceil(rows.length / limit)),
    [rows, limit]
  );
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
  const dataAll = useMemo(
    () => rows.slice(startSlice, startSlice + limit),
    [rows, startSlice, limit]
  );

  // ====== UI ======
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">MASTER</li>
                <li className="breadcrumb-item active">
                  <Link to="#" className="color-link">
                    ITEM LIST UPLOAD
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="card angle gap-margin">
          <div className="card-header card-picking">UPLOAD ITEM LIST</div>
          <div className="card-body gap-margin">
            {/* File + Preview + Clear */}
            <div
              style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
            >
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
                  setUnknownHeaders([]);
                  setMissingHeaders([]);
                  setStartSlice(0);
                  setCountPage(1);
                }}
                disabled={loading || loadingUpload || rows.length === 0}
              >
                Clear Preview
              </button>
            </div>

            {/* Preview */}
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
                        <th key={i} title={String(h)}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataAll.map((row, idx) => (
                      <tr key={idx}>
                        {headers.map((h, j) => {
                          const v = row[h];
                          const isMissing =
                            (v === "" || v === null || v === undefined) &&
                            REQUIRED_HEADERS.includes(h);
                          return (
                            <td
                              key={j}
                              title={String(v ?? "")}
                              style={isMissing ? { background: "#ffe6e6" } : undefined}
                            >
                              {String(v ?? "")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {rows.length > 0 && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button
                  onClick={Moveleft}
                  className="dropdown-select"
                  style={{ padding: "8px 12px" }}
                >
                  &lt;&lt;
                </button>
                &nbsp; {countPage}/{totalPage} &nbsp;
                <button
                  onClick={Moveright}
                  className="dropdown-select"
                  style={{ padding: "8px 12px" }}
                >
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
                style={{ width: 200, height: 40 }}
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
