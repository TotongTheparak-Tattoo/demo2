import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { httpClient } from "../../../utils/HttpClient";
import "./ScanVoid.css";
import Swal from "sweetalert2";

export default function ScanVoid() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const palletNo = useMemo(
    () => String(state?.palletNo ?? state?.item?.palletNo ?? "").trim(),
    [state]
  );
  const filters = state?.filters || {};

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [parsedScan, setParsedScan] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef(null);
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });
  // ---- API endpoints ----
  const endpointList = "/api/v1/scanvoid/getdataallbymrnull";
  const endpointDelete = (p) => `/api/v1/scanvoid/deletedatabypalletno/${encodeURIComponent(p)}`;

  const fmtDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
  };
  const keyPallet = (v) => String(v ?? "").trim();

  const parseScan = (val) => {
    const parts = String(val || "")
      .trim()
      .split(/[\s,|;]+/)
      .filter(Boolean);
    return {
      pallet: parts[0] || "",
      boxNo: parts[1] || "",
      invoiceNo: parts[2] || "",
      poNo: parts[3] || "",
      parts,
    };
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filters.receiveDate) params.receiveDate = filters.receiveDate;
        if (filters.vendor) params.vendor = filters.vendor;
        const resp = await httpClient.get(endpointList,authHeaders(), { params });
        const data = resp?.data;
        const list = Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data)
          ? data
          : [];
        setAllRows(list);
      } catch (e) {
        console.error("[ScanVoid] fetch error:", e);
        setAllRows([]);
        await Swal.fire({
          icon: "error",
          title: "Load Failed",
          text: "Could not contact the server or load data.",
          confirmButtonText: "OK",
        });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const rows = useMemo(() => {
    if (!palletNo) return [];
    return allRows.filter((r) => keyPallet(r.palletNo) === palletNo);
  }, [allRows, palletNo]);

  const totalQty = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
    [rows]
  );

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const raw = String(scanValue).trim();
    if (!raw || !palletNo) return;

    const parsed = parseScan(raw);
    setParsedScan(parsed);
    setScanValue("");

    const scannedPallet = parsed.pallet;
    const ok = scannedPallet === palletNo;

    if (!ok) {
      const mismatchMsg = `Scanned pallet ("${scannedPallet || "(blank)"}") does not match this Pallet No ("${palletNo || "(blank)"}").`;
      await Swal.fire({
        icon: "warning",
        title: "Pallet Mismatch",
        text: mismatchMsg,
        confirmButtonText: "OK",
      });
      inputRef.current?.focus();
      return;
    }

    try {
      setDeleting(true);
      const resp = await httpClient.delete(endpointDelete(palletNo),authHeaders(),{});
      const deletedCount = Number(resp?.data?.deletedCount ?? 0);

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        html: `Deleted <b>Pallet No: ${palletNo || "(blank)"} </b> with <b>${deletedCount.toLocaleString()}</b> item(s).`,
        confirmButtonText: "OK",
      });

      setAllRows((prev) =>
        prev.filter((r) => keyPallet(r.palletNo) !== palletNo)
      );
    } catch (err) {
      console.error("[ScanVoid] delete error:", err);
      const msg =
        err?.response?.data?.message || err?.message || "Delete failed.";
      await Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: String(msg),
        confirmButtonText: "OK",
      });
    } finally {
      setDeleting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">VOID</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">Scan Void</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Scan Void
            </div>

            <div className="card-body gap-margin">
              {/* Scan input */}
              <form onSubmit={handleScanSubmit} className="mb-3" autoComplete="off">
                <label className="vp-field" style={{ display: "block" }}>
                  <span className="vp-label">Scan Void (Pallet No)</span>
                  <div className="vp-input-wrap" style={{ display: "flex", gap: 8 }}>
                    <input
                      ref={inputRef}
                      type="text"
                      className="form-control angle"
                      placeholder={
                        "scan"
                      }
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          setScanValue((prev) => prev + "\t");
                          e.preventDefault();
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleScanSubmit(e);
                        }
                      
                      }}
                      disabled={deleting}
                    />
                    <button type="submit" className="btn btn-enter angle" disabled={deleting}>
                      {deleting ? "Deleting..." : "Enter"}
                    </button>
                  </div>
                </label>
              </form>

              {/* {parsedScan && (
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="col-md-3"><b>Pallet No:</b> {parsedScan.pallet || "-"}</div>
                  <div className="col-md-3"><b>Box No:</b> {parsedScan.boxNo || "-"}</div>
                  <div className="col-md-3"><b>Invoice No:</b> {parsedScan.invoiceNo || "-"}</div>
                  <div className="col-md-3"><b>PO No:</b> {parsedScan.poNo || "-"}</div>
                </div>
              )} */}

              {/* Table */}
              <div className="table-wrapper mt-2">
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : (
                  <table className="table table-receive table-custom table-compact">
                    <colgroup>
                      <col className="col-date" />
                      <col className="col-vendor" />
                      <col className="col-mi" />
                      <col className="col-pallet" />
                      <col className="col-case" />
                      <col className="col-qty" />
                      <col className="col-spec" />
                      <col className="col-size" />
                    </colgroup>

                    <thead className="text-center">
                      <tr>
                        <th>Receive Date</th>
                        <th>Vendor Name</th>
                        <th>MasterInvoiceNo</th>
                        <th>Pallet ID</th>
                        <th>Case No</th>
                        <th>Quantity</th>
                        <th>Spec</th>
                        <th>Size</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="no-data-cell">📄 No data</td>
                        </tr>
                      ) : (
                        rows.map((r, i) => (
                          <tr
                            key={
                              r.productBalanceId ??
                              `${r.masterInvoiceNo}-${r.caseNo}-${r.palletNo}-${i}`
                            }
                          >
                            <td>{fmtDate(r.receiveDate)}</td>
                            <td>{r.vendorName ?? ""}</td>
                            <td>{r.masterInvoiceNo ?? ""}</td>
                            <td>{r.boxNo ?? ""}</td>
                            <td>{r.caseNo ?? ""}</td>
                            <td>{r.quantity ?? ""}</td>
                            <td>{r.spec ?? ""}</td>
                            <td>{r.size ?? ""}</td>
                            <td>{r.productStatusName ?? ""}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* summary */}
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
                  Items: {rows.length.toLocaleString()} · Quantity: {totalQty.toLocaleString()}
                </span>
                <button className="btn btn-secondary angle" onClick={() => navigate(-1)}>
                  ⟵ Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
