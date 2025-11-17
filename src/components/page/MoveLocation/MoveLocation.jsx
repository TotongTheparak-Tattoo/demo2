import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./MoveLocation.css";

export default function MoveLocation() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Endpoints
  const endpointGetByPallet = (palletNo) =>
    `/api/v1/movelocation/getdatabypallet/${encodeURIComponent(palletNo)}`;
  const endpointGetLocation = (code) =>
    `/api/v1/movelocation/getdatabylocationcode/${encodeURIComponent(code)}`;
  const endpointMoveLocationBulk = () => `/api/v1/movelocation/updatelocation/bulk`;

  // --- ใช้ค่าสนามแรกก่อนแท็บ (รองรับสแกนเนอร์ยิง \t) ---
  const firstField = (v) => String(v ?? "").split("\t")[0].trim();

  const [scanPallet, setScanPallet] = useState("");
  const [scanLocation, setScanLocation] = useState("");

  const [loadingPB, setLoadingPB] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pbList, setPbList] = useState([]);
  const [loc, setLoc] = useState(null);

  const palletRef = useRef(null);
  const locationRef = useRef(null);

  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });

  useEffect(() => {
    palletRef.current?.focus?.();
  }, []);

  const pickErrMsg = (e) => {
    const d = e?.response?.data;
    return d?.result?.message || d?.message || e?.message || "Unknown error";
  };

  const extractRows = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.result?.rows)) return data.result.rows;
    if (Array.isArray(data?.row?.rows)) return data.row.rows;
    if (data?.row) return [data.row];
    if (data?.result?.row) return [data.result.row];
    return [];
  };

  const fmtLocCode = (row) =>
    row?.locationCode ??
    (typeof row?.location === "string" ? row.location : row?.locationId) ??
    "-";

  // ---- Actions ----
  const fetchPBByPallet = async (palletNo) => {
    const pallet = firstField(palletNo);
    if (!pallet) return;

    setLoadingPB(true);
    try {
      const resp = await httpClient.get(endpointGetByPallet(pallet), authHeaders());
      const rows = extractRows(resp?.data);
      if (!rows.length) {
        setPbList([]);
        await Swal.fire({
          icon: "warning",
          title: "Not found",
          text: `No ProductBalance found for PalletNo: ${pallet}`,
        });
        return;
      }

      rows.sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (b.productBalanceId || 0) - (a.productBalanceId || 0);
      });

      setPbList(rows);
      // โฟกัสไปช่อง Location ต่อให้ลื่นไหล
      setTimeout(() => locationRef.current?.focus?.(), 10);
    } catch (e) {
      console.error("[MoveLocation] fetchPBByPallet error:", e);
      setPbList([]);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: pickErrMsg(e) || "Failed to load ProductBalance list",
      });
    } finally {
      setLoadingPB(false);
    }
  };

  const fetchLocation = async (code) => {
    const trimmed = firstField(code);
    if (!trimmed) return;

    setLoadingLoc(true);
    try {
      const resp = await httpClient.get(endpointGetLocation(trimmed), authHeaders());
      const row = resp?.data?.result || null;
      if (!row) {
        setLoc(null);
        await Swal.fire({
          icon: "warning",
          title: "Not found",
          text: `No location found for code: ${trimmed}`,
        });
        return;
      }
      setLoc(row);

      // ถ้ามี pbList อยู่แล้วและไม่อยู่ระหว่าง submitting → ดำเนินการย้ายต่อ
      if (pbList.length > 0 && !submitting) {
        onMoveAll(row);
      }
    } catch (e) {
      console.error("[MoveLocation] fetchLocation error:", e);
      setLoc(null);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: pickErrMsg(e) || "Failed to load location",
      });
    } finally {
      setLoadingLoc(false);
    }
  };

  const onMoveAll = async (overrideLoc = null) => {
    const targetLoc = overrideLoc || loc;

    if (!pbList.length) {
      await Swal.fire({
        icon: "info",
        title: "Pallet not scanned",
        text: "Please scan a PalletNo first.",
      });
      palletRef.current?.focus?.();
      return;
    }
    if (!targetLoc?.locationId) {
      await Swal.fire({
        icon: "info",
        title: "Location not scanned",
        text: "Please scan a Location first.",
      });
      locationRef.current?.focus?.();

      return;
    }

    const codes = pbList.map(fmtLocCode).filter((x) => x && x !== "-");
    const uniq = Array.from(new Set(codes));
    const fromCode = uniq.length === 1 ? uniq[0] : uniq.length ? "multiple" : "-";
    const toCode = targetLoc?.locationCode ?? "-";

    const confirm = await Swal.fire({
      title: "Confirm moving",
      html: `<div style="text-align:center;font-size:16px">
               Move from <b>${fromCode}</b> to <b>${toCode}</b>?
             </div>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) {
      setScanLocation("");       
      setLoc(null);
      setTimeout(() => locationRef.current?.focus?.(), 10); 
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        locationId: Number(targetLoc.locationId),
        items: pbList.map((r) => ({
          productBalanceId: Number(r.productBalanceId),
          productDetailsId: r?.productDetailsId != null ? Number(r.productDetailsId) : null,
          productStatusId: r?.productStatusId != null ? Number(r.productStatusId) : null,
          mrRequestId: r?.mrRequestId != null ? Number(r.mrRequestId) : null,
        })),
      };

      await httpClient.post(endpointMoveLocationBulk(), body, authHeaders());

      await Swal.fire({
        icon: "success",
        title: "Success",
        text: "Moved all items successfully.",
        timer: 1500,
      });

      setPbList((prev) =>
        prev.map((r) => ({
          ...r,
          locationId: targetLoc.locationId,
          locationCode: targetLoc.locationCode,
        }))
      );

      setScanLocation("");
      setLoc(null);
      // ถ้าอยากกลับไปเริ่มสแกน Pallet ใหม่ ให้โฟกัส palletRef
      // palletRef.current?.focus?.();
      locationRef.current?.focus?.();
    } catch (e) {
      console.error("[MoveLocation] move-all error:", e);
      await Swal.fire({
        icon: "error",
        title: "Move failed",
        text: pickErrMsg(e) || "Failed to move location.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onClear = () => {
    setScanPallet("");
    setScanLocation("");
    setPbList([]);
    setLoc(null);
    palletRef.current?.focus?.();
  };

  // ---- Key handlers แบบเดียวกับ Putaway ----
  const handlePalletKeyDown = async (e) => {
    if (e.key === "Tab") {
      // เก็บ \t ที่สแกนเนอร์ยิงมา (ไม่ย้ายโฟกัส)
      setScanPallet((prev) => prev + "\t");
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const palletNo = firstField(scanPallet);
      if (palletNo) {
        await fetchPBByPallet(palletNo);
        // โฟกัสไปช่อง Location
        setTimeout(() => locationRef.current?.focus?.(), 10);
      }
    }
  };

  const handleLocationKeyDown = async (e) => {
    if (e.key === "Tab") {
      setScanLocation((prev) => prev + "\t");
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const code = firstField(scanLocation);
      if (code) {
        await fetchLocation(code); // ถ้า pbList พร้อม จะ onMoveAll ต่อให้
      }
    }
  };

  const readyToMoveAll = pbList.length > 0 && !!loc?.locationId;

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">MOVE LOCATION</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">Move Location</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Move Location
            </div>

            <div className="card-body gap-margin">
              {/* --- Scan Pallet --- */}
              <div className="mb-3">
                <label className="form-label">Scan PalletNo</label>
                <input
                  ref={palletRef}
                  className="form-control angle"
                  style={{ backgroundColor: "#F3F5F5", width: "100%" }}
                  placeholder="Scan/type a PalletNo and press Enter"
                  value={scanPallet}
                  onChange={(e) => setScanPallet(e.target.value)}
                  onKeyDown={handlePalletKeyDown}
                  disabled={loadingPB || submitting}
                />
              </div>

              {/* Table */}
              <div className="mb-4">
                <div className="card angle" style={{ minHeight: 160 }}>
                  <div className="card-header">ProductBalance</div>
                  <div className="card-body">
                    {pbList.length === 0 ? (
                      <div className="text-muted text-center">No PalletNo scanned yet</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-compact table-custom text-nowrap pb-table">
                          <colgroup>
                            <col className="col-id" />
                            <col className="col-pallet" />
                            <col className="col-case" />
                            <col className="col-mstInv" />
                            <col className="col-itemname" />
                            <col className="col-locCode" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>vendor</th>
                              <th>palletNo</th>
                              <th>caseNo</th>
                              <th>masterInvoiceNo</th>
                              <th>ItemName</th>
                              <th>location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pbList.map((r) => (
                              <tr key={r.productBalanceId}>
                                <td className="text-center">{r.vendorMasterName}</td>
                                <td className="text-center">{r.palletNo ?? "-"}</td>
                                <td className="text-center">{r?.ProductDetails?.caseNo ?? r?.caseNo ?? "-"}</td>
                                <td className="text-center">{r?.ProductDetails?.masterInvoiceNo ?? r?.masterInvoiceNo ?? "-"}</td>
                                <td className="text-center">{r?.ProductDetails?.itemName ?? r?.itemName ?? "-"}</td>
                                <td className="text-center">{fmtLocCode(r)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <small className="text-muted">Total {pbList.length} rows</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* --- Scan Location --- */}
              <div className="mb-3">
                <label className="form-label">Scan Location</label>
                <input
                  ref={locationRef}
                  className="form-control angle"
                  style={{ backgroundColor: "#F3F5F5", width: "100%" }}
                  placeholder="Scan/type a Location and press Enter"
                  value={scanLocation}
                  onChange={(e) => setScanLocation(e.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  disabled={loadingLoc || submitting}
                />
              </div>

              {/* Location preview */}
              <div className="mb-4">
                <div className="card angle" style={{ minHeight: 160 }}>
                  <div className="card-header">Location</div>
                  <div className="card-body">
                    {!loc ? (
                      <div className="text-muted text-center">No location scanned yet</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-compact table-custom text-nowrap loc-table">
                          <colgroup>
                            <col className="col-locCode" />
                            <col className="col-rack" />
                            <col className="col-bay" />
                            <col className="col-shelf" />
                            <col className="col-subBay" />
                            <col className="col-locZone" />
                            <col className="col-subLoc" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>locationCode</th>
                              <th>rack</th>
                              <th>bay</th>
                              <th>shelf</th>
                              <th>subBay</th>
                              <th>locationZoneId</th>
                              <th>subLocation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="text-center">{loc.locationCode ?? "-"}</td>
                              <td className="text-center">{loc.rack ?? "-"}</td>
                              <td className="text-center">{loc.bay ?? "-"}</td>
                              <td className="text-center">{loc.shelf ?? "-"}</td>
                              <td className="text-center">{loc.subBay ?? "-"}</td>
                              <td className="text-center">{loc.locationZoneId ?? "-"}</td>
                              <td className="text-center">{loc.subLocation ?? "-"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary angle"
                  onClick={() => onMoveAll()}
                  disabled={!readyToMoveAll || submitting}
                  title={
                    readyToMoveAll
                      ? "Move all rows to the scanned location"
                      : "Please scan both Pallet and Location first"
                  }
                >
                  {submitting ? "Moving..." : "Move All"}
                </button>
                <button
                  className="btn btn-secondary angle"
                  onClick={onClear}
                  disabled={submitting}
                >
                  Clear
                </button>
              </div>

              <div className="vp-footer mt-2">
                <small>Flow: Scan Pallet → show rows → Scan Location → (confirm)</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
