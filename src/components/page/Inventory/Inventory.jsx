import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { httpClient } from "../../../utils/HttpClient";
import "./Inventory.css";

const ENDPOINT_LIST = "/api/inventory/getdata";
const ENDPOINT_IN_PB = "/api/inventory/getalllocationbyproductbalance";

export default function Inventory() {
  // Data state
  const [allRows, setAllRows] = useState([]); // ข้อมูล location ทั้งหมด
  const [inpbByLoc, setInpbByLoc] = useState(new Map()); // ข้อมูล inventory by location (Map<locationKey, rows[]>)
  const [loading, setLoading] = useState(false); // สถานะกำลังโหลดข้อมูล
  // Filter state
  const [rackQuery, setRackQuery] = useState(""); // ค้นหา rack
  const [palletQuery, setPalletQuery] = useState(""); // ค้นหา pallet
  // UI refs
  const wrapperRef = useRef(null); // Reference สำหรับ scroll wrapper
  const boardHostRef = useRef(null); // Reference สำหรับ board container (ใช้สำหรับ resize)
  // ============================================================================
  // HELPER FUNCTIONS - API & Data Normalization
  // ============================================================================
  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}`,
    },
  });
  /*แปลง response จาก API ให้เป็น array*/
  const pluckList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  // ============================================================================
  // HELPER FUNCTIONS - Location & Sorting
  // ============================================================================
  /*Natural string comparison (รองรับตัวเลขใน string)*/
  const natCmp = (a, b) =>
    String(a ?? "").localeCompare(String(b ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  /*แปลง bay เป็นตัวเลขสำหรับเรียงลำดับ*/
  const bayOrder = (v) => {
    const s = String(v ?? "").trim();
    if (/^[A-Za-z]$/.test(s)) return s.toUpperCase().charCodeAt(0) - 64;
    const n = Number(s);
    return Number.isFinite(n) ? n : 9999;
  };
  /*สร้าง key สำหรับ location จาก locationId หรือ locationCode*/
  const getLocKey = (row) => {
    const id = Number(row?.locationId);
    if (Number.isFinite(id) && id > 0) return `id:${id}`;
    const code = String(
      row?.locationCode ?? row?.location ?? row?.locCode ?? row?.code ?? ""
    ).trim();
    if (code) return `code:${code.toUpperCase()}`;
    return null;
  };
  /*หาตัวเลขที่มากที่สุดใน string*/
  const maxNumberInString = (s) => {
    const m = String(s ?? "").match(/\d+/g);
    if (!m) return -Infinity;
    return Math.max(...m.map((x) => parseInt(x, 10)));
  };
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูล location ทั้งหมด*/
  const fetchAll = async () => {
    try {
      const resp = await httpClient.get(ENDPOINT_LIST, authHeaders(), { params: { all: 1 } });
      const list = pluckList(resp?.data);
      setAllRows(list);
      wrapperRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("[Inventory] fetchAll error:", e);
      setAllRows([]);
      await Swal.fire({
        icon: "error",
        title: "Load failed",
        text: e?.response?.data?.message || e?.message || "Could not contact the server or load data.",
        confirmButtonText: "OK",
      });
    }
  };

  /*ดึงข้อมูล inventory by location และจัดกลุ่มตาม location key*/
  const fetchInPB = async () => {
    try {
      const resp = await httpClient.get(ENDPOINT_IN_PB, authHeaders(), { params: { all: 1 } });
      const list = pluckList(resp?.data);
      const by = new Map();

      // จัดกลุ่มตาม location key
      for (const row of list) {
        const k = getLocKey(row);
        if (!k) continue;
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(row);
      }

      setInpbByLoc(by);
    } catch (e) {
      console.error("[Inventory] fetchInPB error:", e);
      setInpbByLoc(new Map());
    }
  };

  /*ดึงข้อมูลทั้งสอง endpoint พร้อมกัน*/
  const fetchBoth = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchAll(), fetchInPB()]);
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchBoth();
  }, []);
  // ============================================================================
  // COMPUTED VALUES - Highlights
  // ============================================================================
  /*Set ของ rack names ที่ตรงกับ rackQuery (สำหรับ highlight)*/
  const rackHighlightSet = useMemo(() => {
    const q = rackQuery.trim().toLowerCase();
    if (!q) return new Set();
    return new Set(
      (allRows || [])
        .filter((r) => String(r?.rack ?? "").toLowerCase().includes(q))
        .map((r) => String(r?.rack ?? "").trim())
    );
  }, [allRows, rackQuery]);
  /*Set ของ location keys ที่มี pallet ตรงกับ palletQuery (สำหรับ highlight)*/
  const palletHlLocKeys = useMemo(() => {
    const q = palletQuery.trim().toLowerCase();
    if (!q) return new Set();
    const set = new Set();
    for (const [key, arr] of inpbByLoc.entries()) {
      if (arr?.some((row) => String(row?.palletNo ?? "").toLowerCase().includes(q))) {
        set.add(key);
      }
    }
    return set;
  }, [inpbByLoc, palletQuery]);

  // ============================================================================
  // COMPUTED VALUES - Data Grouping
  // ============================================================================
  /*จัดกลุ่ม rows ตาม rack และเรียงลำดับ*/
  const racks = useMemo(() => {
    const map = new Map();
    // จัดกลุ่มตาม rack
    for (const r of allRows || []) {
      const rack = String(r?.rack ?? "").trim();
      if (!rack) continue;
      if (!map.has(rack)) map.set(rack, []);
      map.get(rack).push(r);
    }
    const groups = [];
    // ประมวลผลแต่ละ rack
    for (const [rack, items] of map.entries()) {
      // หาจำนวน columns (subBay) ที่มากที่สุด
      const cols = Math.max(
        1,
        ...items.map((it) => {
          const n = Number(it?.subLocation);
          return Number.isFinite(n) && n > 0 ? n : 1;
        })
      );
      // เรียงลำดับ items: shelf -> bay -> subBay -> locationCode
      const sorted = items.slice().sort((a, b) => {
        const sa = Number(a?.shelf) || 0;
        const sb = Number(b?.shelf) || 0;
        if (sa !== sb) return sa - sb;

        const ba = bayOrder(a?.bay);
        const bb = bayOrder(b?.bay);
        if (ba !== bb) return ba - bb;

        const sba = Number(a?.subBay) || 0;
        const sbb = Number(b?.subBay) || 0;
        if (sba !== sbb) return sba - sbb;

        return natCmp(a?.locationCode, b?.locationCode);
      });
      // คำนวณจำนวนแถว
      const rows = Math.max(1, Math.ceil(sorted.length / cols));
      groups.push({ rack, cols, items: sorted, rows });
    }
    // เรียงลำดับ groups: ตามตัวเลขใน rack name, แล้วตาม natural string
    groups.sort((a, b) => {
      const nb = maxNumberInString(b.rack);
      const na = maxNumberInString(a.rack);
      if (nb !== na) return nb - na;
      return natCmp(a.rack, b.rack);
    });

    return groups;
  }, [allRows]);
  /*แปลง racks เป็น board layout (grid) สำหรับแสดงผล*/
  const board = useMemo(() => {
    const boardRows = Math.max(1, ...racks.map((g) => g.rows || 1));
    let startCol = 0;
    const pieces = [];
    // สร้าง pieces สำหรับแต่ละ rack
    for (let ri = 0; ri < racks.length; ri++) {
      const g = racks[ri];
      const isFirstRack = ri === 0;
      // สร้าง pieces สำหรับแต่ละ cell ใน rack
      for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const idx = r * g.cols + c;
          const item = g.items[idx];
          pieces.push({
            key: `${g.rack}:${r}:${c}`,
            colStart: startCol + c + 1,
            rowStart: r + 1,
            item,
            rackEdgeRight: c === g.cols - 1, // ขอบขวาของ rack
            rackEdgeLeftNoLine: !isFirstRack && c === 0, // ขอบซ้ายของ rack (ไม่ใช่ rack แรก)
          });
        }
      }
      startCol += g.cols;
    }

    return { pieces, boardRows, totalCols: startCol };
  }, [racks]);
  // ============================================================================
  // COMPUTED VALUES - Statistics
  // ============================================================================
  /*สถิติการใช้ rack (C และ B)*/
  const rackStats = useMemo(() => {
    const stats = {
      C: { total: 0, used: 0, empty: 0 },
      B: { total: 0, used: 0, empty: 0 },
    };
    // นับแต่ละ piece
    for (const p of board.pieces) {
      if (!p.item) continue;

      const rackName = String(p.item?.rack ?? "").trim().toUpperCase();
      const keyById = getLocKey({ locationId: p.item.locationId });
      const keyByCode = getLocKey({ locationCode: p.item.locationCode });
      const hasData =
        (keyById && inpbByLoc.has(keyById)) || (keyByCode && inpbByLoc.has(keyByCode));

      if (rackName.startsWith("C")) {
        stats.C.total++;
        if (hasData) stats.C.used++;
        else stats.C.empty++;
      } else if (rackName.startsWith("B")) {
        stats.B.total++;
        if (hasData) stats.B.used++;
        else stats.B.empty++;
      }
    }

    // คำนวณเปอร์เซ็นต์
    stats.C.percentage =
      stats.C.total > 0 ? ((stats.C.used / stats.C.total) * 100).toFixed(2) : "0.00";
    stats.B.percentage =
      stats.B.total > 0 ? ((stats.B.used / stats.B.total) * 100).toFixed(2) : "0.00";

    return stats;
  }, [board.pieces, inpbByLoc]);
  // ============================================================================
  // COMPUTED VALUES - Headers & Labels
  // ============================================================================
  /*Headers สำหรับ rack (แสดงชื่อ rack ข้างบน)*/
  const rackHeaders = useMemo(() => {
    let start = 0;
    return racks.map((g) => {
      const h = { rack: g.rack, colStart: start + 1, span: g.cols };
      start += g.cols;
      return h;
    });
  }, [racks]);
  /*Headers สำหรับ subBay (แสดงหมายเลข subBay)*/
  const subBayHeaders = useMemo(() => {
    let startCol = 0;
    const headers = [];
    racks.forEach((g) => {
      for (let i = 0; i < g.cols; i++) {
        // g.cols แทนจำนวน subBay
        headers.push({
          rack: g.rack,
          subBay: i + 1, // SubBay numbers เป็น 1-based
          colStart: startCol + i + 1,
          span: 1,
        });
      }
      startCol += g.cols;
    });
    return headers;
  }, [racks]);
  // ============================================================================
  // EFFECTS - Auto-fit Cell Size
  // ============================================================================
  /*ปรับขนาด cell อัตโนมัติตามขนาดหน้าจอ*/
  const lastSizeRef = useRef(0);
  useEffect(() => {
    const host = boardHostRef.current;
    if (!host) return;
    const GAP = 8;
    const MIN_CELL = 12;
    /*กำหนดขนาด cell ตามความกว้าง*/
    const applySize = (width) => {
      const totalCols = Math.max(1, board.totalCols || 1);
      let size = (width - GAP) / (totalCols + 1);
      size = Math.max(MIN_CELL, Math.floor(size));
      if (size === lastSizeRef.current) return;
      lastSizeRef.current = size;
      host.style.setProperty("--cell-size", `${size}px`);
      host.style.setProperty("--axis-width", `${size}px`);
      host.style.setProperty("--head-height", `${size}px`);
    };
    /*คำนวณขนาดใหม่*/
    const recompute = () => {
      const width = host.clientWidth || 0;
      applySize(width);
    };

    const observedEl = host.parentElement || host;
    let rafId = 0;
    // ใช้ ResizeObserver เพื่อตรวจจับการเปลี่ยนแปลงขนาด
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width =
        (entry.borderBoxSize && entry.borderBoxSize[0]?.inlineSize) ||
        (entry.contentBoxSize && entry.contentBoxSize[0]?.inlineSize) ||
        entry.contentRect.width ||
        observedEl.clientWidth ||
        0;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => applySize(Math.floor(width)));
    });

    ro.observe(observedEl);

    //window resize event
    const onWinResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recompute);
    };
    window.addEventListener("resize", onWinResize);

    recompute();

    return () => {
      cancelAnimationFrame(rafId);
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", onWinResize);
    };
  }, [board.totalCols]);
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  /*แสดงรายละเอียดของ location ใน dialog*/
  const showLocationDetails = async (locItem) => {
    if (!locItem) return;
    // หา location key
    const keyById = getLocKey({ locationId: locItem.locationId });
    const keyByCode = getLocKey({ locationCode: locItem.locationCode });
    const rows =
      (keyById && inpbByLoc.get(keyById)) || (keyByCode && inpbByLoc.get(keyByCode)) || [];
    if (!rows.length) return;
    // กำหนด fields ที่ต้องการแสดง
    const fields = [
      "palletNo",
      "masterInvoiceNo",
      "caseNo",
      "lotNo",
      "spec",
      "size",
      "unit",
      "locationCode",
      "quantity",
    ];
    /*ดึงค่าจาก row ตาม field name*/
    const getVal = (r, k) => {
      if (k === "lotNo") {
        const v = r?.lotNo ?? r?.lot_no ?? r?.LotNo ?? r?.LOTNO;
        return v ?? "";
      }
      let v = r?.[k];
      if (v == null) v = "";
      if (typeof v === "object") v = JSON.stringify(v);
      return v;
    };
    // สร้าง HTML table
    const th = fields
      .map(
        (k) =>
          `<th style="white-space:nowrap;padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${k}</th>`
      )
      .join("");

    const trs = rows
      .map((r) => {
        const tds = fields
          .map((k) => {
            const v = getVal(r, k);
            return `<td style="padding:6px 8px;border-bottom:1px solid #f2f2f2;vertical-align:middle;text-align:center">${String(
              v
            )}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    const title = `${locItem.locationCode || locItem.rack || "Location"} — ${rows.length} item(s)`;
    const html = `
    <div style="max-height:70vh;overflow:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:center">
        <thead><tr>${th}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  `;

    await Swal.fire({
      title,
      html,
      width: Math.min(window.innerWidth - 40, 1000),
      confirmButtonText: "Close",
    });
  };
  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper" ref={wrapperRef}>
        <div className="container-fluid">
          {/* Main Card */}
          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Inventory Layout
            </div>

            <div className="card-body gap-margin">
              {/* Statistics Table */}
              <div className="mt-3 mb-3">
                <div className="card" style={{ border: "1px solid #dee2e6" }}>
                  <div className="card-body" style={{ padding: "15px" }}>
                    <table className="table table-bordered" style={{ marginBottom: 0 }}>
                      <thead style={{ backgroundColor: "#f8f9fa" }}>
                        <tr>
                          <th style={{ textAlign: "center", padding: "10px" }}>Rack Type</th>
                          <th style={{ textAlign: "center", padding: "10px" }}>Quota</th>
                          <th
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#f8d7da",
                            }}
                          >
                            Occupied
                          </th>
                          <th
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#d4edda",
                            }}
                          >
                            Available
                          </th>
                          <th style={{ textAlign: "center", padding: "10px" }}>Usege</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Rack C Row */}
                        <tr>
                          <td style={{ textAlign: "center", padding: "10px", fontWeight: "bold" }}>
                            Rack C
                          </td>
                          <td style={{ textAlign: "center", padding: "10px", fontWeight: "bold" }}>
                            {rackStats.C.total.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#f8d7da",
                              fontWeight: "bold",
                            }}
                          >
                            {rackStats.C.used.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#d4edda",
                              fontWeight: "bold",
                            }}
                          >
                            {rackStats.C.empty.toLocaleString()}
                          </td>
                          <td style={{ textAlign: "center", padding: "10px", fontWeight: "bold" }}>
                            {rackStats.C.percentage}%
                          </td>
                        </tr>

                        {/* Rack B Row */}
                        <tr>
                          <td style={{ textAlign: "center", padding: "10px", fontWeight: "bold" }}>
                            Rack B
                          </td>
                          <td style={{ textAlign: "center", padding: "10px", fontWeight: "bold" }}>
                            {rackStats.B.total.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#f8d7da",
                              fontWeight: "bold",
                            }}
                          >
                            {rackStats.B.used.toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#d4edda",
                              fontWeight: "bold",
                            }}
                          >
                            {rackStats.B.empty.toLocaleString()}
                          </td>
                          <td style={{ textAlign: "center", padding: "10px", fontWeight: "bold" }}>
                            {rackStats.B.percentage}%
                          </td>
                        </tr>

                        {/* Total Row */}
                        <tr style={{ backgroundColor: "#f8f9fa", fontWeight: "bold" }}>
                          <td style={{ textAlign: "center", padding: "10px" }}>Total</td>
                          <td style={{ textAlign: "center", padding: "10px" }}>
                            {(rackStats.C.total + rackStats.B.total).toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#f8d7da",
                            }}
                          >
                            {(rackStats.C.used + rackStats.B.used).toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px",
                              backgroundColor: "#d4edda",
                            }}
                          >
                            {(rackStats.C.empty + rackStats.B.empty).toLocaleString()}
                          </td>
                          <td style={{ textAlign: "center", padding: "10px" }}>
                            {rackStats.C.total + rackStats.B.total > 0
                              ? (
                                  ((rackStats.C.used + rackStats.B.used) /
                                    (rackStats.C.total + rackStats.B.total)) *
                                  100
                                ).toFixed(2)
                              : "0.00"}
                            %
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {/* Filter Controls */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {/* Rack Search */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vp-label" style={{ minWidth: 90 }}>
                    Rack
                  </span>
                  <input
                    type="text"
                    className="form-control angle"
                    value={rackQuery}
                    onChange={(e) => setRackQuery(e.target.value)}
                    placeholder=""
                    style={{ minWidth: 200 }}
                  />
                </label>
                {/* Refresh Button */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-secondary angle"
                    onClick={fetchBoth}
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </label>
                <div style={{ flex: 1 }} />
                {/* Rack Count */}
                <label className="vp-field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontStyle: "italic" }}>Racks: {racks.length.toLocaleString()}</span>
                </label>
              </div>

              {/* Board: Grid Layout with Headers and Axis */}
              <div
                className="board-with-axes mt-3 axis-right"
                ref={boardHostRef}
                style={{ "--cols": board.totalCols, "--rows": board.boardRows }}
              >
                {/* Main Area */}
                <div className="board-main">
                  {/* Rack Headers */}
                  <div className="rack-headers">
                    {rackHeaders.map((h) => {
                      const hl = rackHighlightSet.has(h.rack);
                      return (
                        <div
                          key={`hdr-${h.rack}`}
                          className={`rack-header${hl ? " is-hl" : ""}`}
                          style={{ gridColumn: `${h.colStart} / span ${h.span}` }}
                        >
                          {h.rack}
                        </div>
                      );
                    })}
                  </div>

                  {/* SubBay Headers */}
                  <div className="subbay-headers">
                    {subBayHeaders.map((h) => {
                      const hl = rackHighlightSet.has(h.rack);
                      return (
                        <div
                          key={`subbay-hdr-${h.rack}-${h.subBay}`}
                          className={`subbay-header${hl ? " is-hl" : ""}`}
                          style={{ gridColumn: `${h.colStart} / span ${h.span}` }}
                        >
                          {h.subBay}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid Cells */}
                  <div className="inv-board-grid">
                    {loading ? (
                      <div className="loading">Loading...</div>
                    ) : (
                      board.pieces
                        .filter((p) => !!p.item)
                        .map((p) => {
                          const keyById = getLocKey({ locationId: p.item.locationId });
                          const keyByCode = getLocKey({ locationCode: p.item.locationCode });
                          const locKey = keyById || keyByCode;

                          const hasData =
                            (keyById && inpbByLoc.has(keyById)) ||
                            (keyByCode && inpbByLoc.has(keyByCode));

                          const rackHL = rackHighlightSet.has(String(p.item?.rack ?? "").trim());
                          const palletHL = locKey && palletHlLocKeys.has(locKey);

                          const cls = [
                            "inv-box",
                            p.rackEdgeRight ? "rack-right" : "",
                            p.rackEdgeLeftNoLine ? "rack-left-noline" : "",
                            rackHL ? "is-hl" : "",
                            palletHL ? "is-hl-pallet" : "",
                          ]
                            .filter(Boolean)
                            .join(" ");
                          /*กำหนดสีพื้นหลังตาม rack type และสถานะ*/
                          const getBackgroundColor = () => {
                            if (!hasData) return "#d9d9d9"; // ว่าง - สีเทา
                            const rackName = String(p.item?.rack ?? "").trim().toUpperCase();
                            if (rackName.startsWith("C")) return "#ff8c00"; // Rack C - สีส้ม
                            if (rackName.startsWith("B")) return "#ff87ff"; // Rack B - สีชมพู
                          };
                          return (
                            <div
                              key={p.key}
                              className={cls}
                              style={{
                                gridColumnStart: p.colStart,
                                gridRowStart: p.rowStart,
                                background: getBackgroundColor(),
                                cursor: hasData ? "pointer" : "default",
                              }}
                              title={p.item?.locationCode || ""}
                              onClick={() => hasData && showLocationDetails(p.item)}
                            />
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
