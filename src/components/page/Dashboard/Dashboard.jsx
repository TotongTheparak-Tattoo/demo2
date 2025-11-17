import React, { useEffect, useMemo, useState } from "react";
import { httpClient } from "../../../utils/HttpClient";
import { FaBell } from "react-icons/fa";
import Chart from "react-apexcharts";
import "./Dashboard.css";

const ENDPOINT_PRODUCT_LOG = "/api/v1/productlog/getdata";
const ENDPOINT_INVENTORY = "/api/inventory/getdata";
const ENDPOINT_LOCATION_BY_PB = "/api/inventory/getalllocationbyproductbalance";
const ENDPOINT_STOCK_MOVEMENT = "/api/v1/stock/movement";

export default function Dashboard() {
  const [loading, setLoading] = useState(false); /*จำนวน status 1 (INBOUND RECEIVE) แบบ daily*/
  const [status1Count, setStatus1Count] = useState(0); /*จำนวน status 2 (INBOUND PUT AWAY) แบบ daily*/
  const [status2Count, setStatus2Count] = useState(0); /*จำนวน status 3 (OUTBOUND PICKING) แบบ daily*/
  const [status3Count, setStatus3Count] = useState(0); /*จำนวน location ที่ใช้แล้ว (unique locationCode)*/
  const [locationUsedCount, setLocationUsedCount] = useState(0); /*จำนวน location ทั้งหมด*/
  const [totalLocation, setTotalLocation] = useState(0); /*จำนวน pallets ที่อายุน้อยกว่า 6 เดือน*/
  const [palletsLessThan6Months, setPalletsLessThan6Months] = useState(0); /*จำนวน pallets ที่อายุ 6-12 เดือน*/
  const [pallets6To12Months, setPallets6To12Months] = useState(0); /*จำนวน pallets ที่อายุมากกว่า 12 เดือน*/
  const [palletsMoreThan12Months, setPalletsMoreThan12Months] = useState(0); /*ข้อมูลกราฟ 7 วันล่าสุด (Inbound และ Outbound)*/
  const [transaction7DaysData, setTransaction7DaysData] = useState({
    dates: [], // วันที่ 7 วันล่าสุด
    inbound: [], // จำนวน Inbound (status 1) แต่ละวัน
    outbound: [], // จำนวน Outbound (status 3) แต่ละวัน
  });
  /*ข้อมูล location used by racktype (B, C) สำหรับ stacked bar chart*/
  const [locationByRackType, setLocationByRackType] = useState({
    rackTypes: [], // ['B', 'C']
    used: [], // เปอร์เซ็นต์ location used ของแต่ละ racktype
    remain: [], // เปอร์เซ็นต์ location remain ของแต่ละ racktype
  });

  // ============================================================================
  // HELPER FUNCTIONS - API
  // ============================================================================
  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("TOKEN") || ""}` },
  });
  /*แปลง response จาก API ให้เป็น array*/
  const pluckRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.result)) return payload.result;
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) return [payload];
    return [];
  };
  /*Get today's date in YYYY-MM-DD format*/
  const getTodayYMD = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  /*Get date string for N days ago*/
  const getDateNDaysAgo = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  /*Get array of last 7 days dates*/
  const getLast7Days = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      dates.push(getDateNDaysAgo(i));
    }
    return dates;
  };
  /*แปลงค่าเป็น Date object*/
  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  /*คำนวณจำนวนเดือนจากวันที่ที่กำหนดจนถึงวันนี้ (ใช้ logic เดียวกับ StockMovement.jsx)*/
  const diffMonths = (from, nowDate) => {
    const d = toDate(from);
    if (!d) return null;
    const now = nowDate || new Date();
    const years = now.getFullYear() - d.getFullYear();
    const months = years * 12 + (now.getMonth() - d.getMonth());
    // ถ้าวันที่ยังไม่ถึงวันเดียวกันในเดือนนี้ ให้หัก 1 เดือน
    const adjust = now.getDate() < d.getDate() ? -1 : 0;
    return Math.max(0, months + adjust);
  };
  /*วันที่ปัจจุบัน (ใช้สำหรับคำนวณ months) - Memoize เพื่อไม่ให้สร้างใหม่ทุกครั้ง render*/
  const now = useMemo(() => new Date(), []);
  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  /*ดึงข้อมูล dashboard (นับ status 1, 2, 3 และ location used แบบ daily)*/
  const fetchDashboardData = async () => {
    setLoading(true);
    // ใช้ now จาก useMemo หรือสร้างใหม่ถ้ายังไม่มี
    const currentNow = now || new Date();
    try {
      const today = getTodayYMD();

      // ดึงข้อมูลทั้งหมดของวันนี้ (ไม่ใช้ pagination เพื่อนับทั้งหมด)
      const params = {
        page: 1,
        limit: 10000, // จำนวนมากเพื่อให้ได้ข้อมูลทั้งหมด
        dateFrom: today,
        dateTo: today,
      };
      const resp = await httpClient.get(ENDPOINT_PRODUCT_LOG, { ...authHeaders(), params });
      const data = resp?.data ?? {};
      const allRows = pluckRows(data);
      // นับ status 1, 2, 3
      let count1 = 0;
      let count2 = 0;
      let count3 = 0;

      allRows.forEach((row) => {
        // นับ status 1, 2, 3 จาก productStatusId
        const statusId = Number(row?.productStatusId ?? 0);
        
        if (statusId === 1) {
          count1++;
        } else if (statusId === 2) {
          count2++;
        } else if (statusId === 3) {
          count3++;
        }
      });

      setStatus1Count(count1);
      setStatus2Count(count2);
      setStatus3Count(count3);
      // ดึง location used จาก API getalllocationbyproductbalance
      try {
        const locResp = await httpClient.get(ENDPOINT_LOCATION_BY_PB, {
          ...authHeaders(),
          params: { all: 1 },
        });
        const locData = locResp?.data ?? {};
        const locList = pluckRows(locData);
        
        // นับ unique locationCode
        const locationSet = new Set();
        locList.forEach((row) => {
          const locationCode = String(row?.locationCode ?? "").trim();
          if (locationCode) {
            locationSet.add(locationCode);
          }
        });
        
        setLocationUsedCount(locationSet.size);
      } catch (e) {
        console.warn("[Dashboard] Failed to fetch location used, using default:", e);
        setLocationUsedCount(0);
      }
      // ดึง total location จาก inventory API
      try {
        const invResp = await httpClient.get(ENDPOINT_INVENTORY, {
          ...authHeaders(),
          params: { all: 1 },
        });
        const invData = invResp?.data ?? {};
        const invList = pluckRows(invData);
        setTotalLocation(invList.length > 0 ? invList.length : 3860); // ใช้ค่าจาก API หรือ default
      } catch (e) {
        console.warn("[Dashboard] Failed to fetch total location, using default:", e);
        setTotalLocation(3860); // ใช้ค่าจากรูปเป็น default
      }
      // ดึงข้อมูล pallets จาก stock movement API (ดึงทั้งหมด)
      try {
        const allStockRows = [];
        let pageCursor = 1;
        const batchSize = 1000;
        let totalExpected = 0;

        // Loop ดึงข้อมูลทั้งหมด
        while (true) {
          const stockResp = await httpClient.get(ENDPOINT_STOCK_MOVEMENT, {
            ...authHeaders(),
            params: { page: pageCursor, limit: batchSize },
          });
          const stockData = stockResp?.data ?? {};
          const pageRows = pluckRows(stockData);

          if (pageCursor === 1) {
            // ดึง total จาก response
            totalExpected =
              stockData?.result?.totalCount ??
              stockData?.total ??
              stockData?.count ??
              pageRows.length;
          }

          if (pageRows.length > 0) {
            allStockRows.push(...pageRows);
          }

          // เงื่อนไขหยุด loop
          const reachedTotal = totalExpected > 0 && allStockRows.length >= totalExpected;
          const noMoreData = pageRows.length < batchSize;

          if (reachedTotal || noMoreData) break;

          pageCursor += 1;
        }
        // นับ pallets ตามอายุ
        let countLessThan6 = 0;
        let count6To12 = 0;
        let countMoreThan12 = 0;

        allStockRows.forEach((row) => {
          const stockInDate = row?.stockInDate ?? null;
          const months = diffMonths(stockInDate, currentNow);

          if (months === null) return; // ข้ามถ้าไม่มีวันที่

          // ใช้ logic เดียวกับ StockMovement.jsx: < 6, <= 12, > 12
          if (months < 6) {
            countLessThan6++;
          } else if (months <= 12) {
            count6To12++;
          } else {
            countMoreThan12++;
          }
        });
        setPalletsLessThan6Months(countLessThan6);
        setPallets6To12Months(count6To12);
        setPalletsMoreThan12Months(countMoreThan12);
      } catch (e) {
        console.warn("[Dashboard] Failed to fetch stock movement data:", e);
        setPalletsLessThan6Months(0);
        setPallets6To12Months(0);
        setPalletsMoreThan12Months(0);
      }
      // ดึงข้อมูล 7 วันล่าสุดสำหรับกราฟ
      try {
        const last7Days = getLast7Days();
        const inboundData = [];
        const outboundData = [];
        const dateLabels = [];
        // ดึงข้อมูลแต่ละวัน
        for (const date of last7Days) {
          const dayResp = await httpClient.get(ENDPOINT_PRODUCT_LOG, {
            ...authHeaders(),
            params: {
              page: 1,
              limit: 10000,
              dateFrom: date,
              dateTo: date,
            },
          });
          const dayData = dayResp?.data ?? {};
          const dayRows = pluckRows(dayData);

          let dayInbound = 0;
          let dayOutbound = 0;

          dayRows.forEach((row) => {
            const statusId = Number(row?.productStatusId ?? 0);
            if (statusId === 1) {
              dayInbound++;
            } else if (statusId === 3) {
              dayOutbound++;
            }
          });

          inboundData.push(dayInbound);
          outboundData.push(dayOutbound);
          dateLabels.push(date);
        }

        setTransaction7DaysData({
          dates: dateLabels,
          inbound: inboundData,
          outbound: outboundData,
        });
      } catch (e) {
        console.warn("[Dashboard] Failed to fetch 7 days transaction data:", e);
        const last7Days = getLast7Days();
        setTransaction7DaysData({
          dates: last7Days,
          inbound: Array(7).fill(0),
          outbound: Array(7).fill(0),
        });
      }
      // ดึงข้อมูล location used by racktype (B, C)
      try {
        // ดึง location ทั้งหมด
        const allLocResp = await httpClient.get(ENDPOINT_INVENTORY, {
          ...authHeaders(),
          params: { all: 1 },
        });
        const allLocData = allLocResp?.data ?? {};
        const allLocList = pluckRows(allLocData);
        // ดึง location used
        const usedLocResp = await httpClient.get(ENDPOINT_LOCATION_BY_PB, {
          ...authHeaders(),
          params: { all: 1 },
        });
        const usedLocData = usedLocResp?.data ?? {};
        const usedLocList = pluckRows(usedLocData);
        // สร้าง Set ของ locationCode ที่ใช้แล้ว
        const usedLocationSet = new Set();
        usedLocList.forEach((row) => {
          const locationCode = String(row?.locationCode ?? "").trim();
          if (locationCode) {
            usedLocationSet.add(locationCode);
          }
        });
        // จัดกลุ่มตาม rackType (B, C)
        const rackTypeStats = {
          B: { total: 0, used: 0 },
          C: { total: 0, used: 0 },
        };
        allLocList.forEach((row) => {
          const rack = String(row?.rack ?? "").trim().toUpperCase();
          const locationCode = String(row?.locationCode ?? "").trim();

          if (rack.startsWith("B")) {
            rackTypeStats.B.total++;
            if (usedLocationSet.has(locationCode)) {
              rackTypeStats.B.used++;
            }
          } else if (rack.startsWith("C")) {
            rackTypeStats.C.total++;
            if (usedLocationSet.has(locationCode)) {
              rackTypeStats.C.used++;
            }
          }
        });
        // คำนวณ percentage
        const rackTypes = [];
        const usedPercentages = [];
        const remainPercentages = [];

        ["B", "C"].forEach((type) => {
          const stats = rackTypeStats[type];
          if (stats.total > 0) {
            const usedPercent = (stats.used / stats.total) * 100;
            const remainPercent = 100 - usedPercent;

            rackTypes.push(type);
            usedPercentages.push(Number(usedPercent.toFixed(2)));
            remainPercentages.push(Number(remainPercent.toFixed(2)));
          }
        });

        setLocationByRackType({
          rackTypes,
          used: usedPercentages,
          remain: remainPercentages,
        });
      } catch (e) {
        console.warn("[Dashboard] Failed to fetch location by racktype data:", e);
        setLocationByRackType({
          rackTypes: ["B", "C"],
          used: [0, 0],
          remain: [100, 100],
        });
      }
    } catch (e) {
      console.error("[Dashboard] fetchDashboardData error:", e);
      setStatus1Count(0);
      setStatus2Count(0);
      setStatus3Count(0);
      setLocationUsedCount(0);
    } finally {
      setLoading(false);
    }
  };
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 300000); // Refresh every 300 seconds

    return () => clearInterval(interval);
  }, []);
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  /*คำนวณเปอร์เซ็นต์ location used*/
  const locationUsedPercentage = useMemo(() => {
    if (totalLocation === 0) return 0;
    return Math.round((locationUsedCount / totalLocation) * 100);
  }, [locationUsedCount, totalLocation]);
  /*คำนวณจำนวน WAITING PUT AWAY (receive - putaway)*/
  const waitingPutAway = useMemo(() => {
    return Math.max(0, status1Count - status2Count);
  }, [status1Count, status2Count]);
  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          {/* Dashboard Cards */}
          <div
            className="row"
            style={{
              marginTop: "20px",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {/* Status 1 Card - Blue */}
            <div className="col-md-3 col-sm-6 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#4A90E2",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  textAlign: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontSize: "80px",
                    fontWeight: "bold",
                  }}
                >
                  {loading ? "..." : status1Count.toLocaleString()}
                </div>
                <div style={{ fontSize: "16px", fontWeight: "500" }}>INBOUND RECEIVE</div>
              </div>
            </div>

            {/* Status 2 Card - Green */}
            <div className="col-md-3 col-sm-6 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#50C878",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  textAlign: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontSize: "80px",
                    fontWeight: "bold",
                  }}
                >
                  {loading ? "..." : status2Count.toLocaleString()}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: "16px", fontWeight: "500" }}>INBOUND PUT AWAY</div>
                  <div
                    style={{
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      opacity: 0.9,
                    }}
                  >
                    <span>WAITING PUT AWAY</span>
                    <span style={{ fontWeight: "bold" }}>
                      {loading ? "..." : waitingPutAway.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status 3 Card - Red */}
            <div className="col-md-3 col-sm-6 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#E74C3C",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  textAlign: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontSize: "80px",
                    fontWeight: "bold",
                  }}
                >
                  {loading ? "..." : status3Count.toLocaleString()}
                </div>
                <div style={{ fontSize: "16px", fontWeight: "500" }}>OUTBOUND PICKING</div>
              </div>
            </div>

            {/* Location Used Card - Orange */}
            <div className="col-md-3 col-sm-6 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#FF8C00",
                  color: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  textAlign: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    fontSize: "48px",
                    fontWeight: "bold",
                  }}
                >
                  {loading ? "..." : locationUsedCount.toLocaleString()}
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "500", marginBottom: "12px" }}>
                    LOCATION USED
                  </div>
                  
                  {/* Progress Bar */}
                  <div
                    style={{
                      width: "100%",
                      height: "20px",
                      backgroundColor: "rgba(255,255,255,0.3)",
                      borderRadius: "10px",
                      overflow: "hidden",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: `${locationUsedPercentage}%`,
                        height: "100%",
                        backgroundColor: "#fff",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Total Location */}
                  <div
                    style={{
                      fontSize: "14px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>TOTAL LOCATION</span>
                    <span style={{ fontWeight: "bold" }}>
                      {totalLocation.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Chart and Pallets Cards */}
          <div className="row" style={{ marginTop: "20px", marginBottom: "20px" }}>
            {/* Transaction 7 Days Chart */}
            <div className="col-md-4 col-sm-12 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "20px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  height: "430px",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#333",
                  }}
                >
                  TRANSACTION 7 DAYS CHART
                </h3>
                <div style={{ flex: 1 }}>
                  {loading ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      <span style={{ color: "#999", fontSize: "14px" }}>Loading...</span>
                    </div>
                  ) : (
                    <Chart
                      type="line"
                      height={350}
                      series={[
                        {
                          name: "Inbound",
                          data: transaction7DaysData.inbound,
                        },
                        {
                          name: "Outbound",
                          data: transaction7DaysData.outbound,
                        },
                      ]}
                      options={{
                        chart: {
                          type: "line",
                          toolbar: {
                            show: false,
                          },
                        },
                        colors: ["#4A90E2", "#50C878"],
                        stroke: {
                          curve: "smooth",
                          width: 2,
                        },
                        markers: {
                          size: 5,
                          hover: {
                            size: 7,
                          },
                        },
                        xaxis: {
                          categories: transaction7DaysData.dates,
                          title: {
                            text: "Month",
                          },
                        },
                        yaxis: {
                          title: {
                            text: "",
                          },
                          min: 0,
                          forceNiceScale: true,
                        },
                        grid: {
                          borderColor: "#e0e0e0",
                          strokeDashArray: 0,
                        },
                        legend: {
                          position: "top",
                          horizontalAlign: "right",
                        },
                        tooltip: {
                          shared: true,
                          intersect: false,
                        },
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            {/* Location Used by RackType Chart */}
            <div className="col-md-4 col-sm-12 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "20px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  height: "430px",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#333",
                  }}
                >
                  LOCATION USED BY RACKTYPE (B, C)
                </h3>
                <div style={{ flex: 1 }}>
                  {loading ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      <span style={{ color: "#999", fontSize: "14px" }}>Loading...</span>
                    </div>
                  ) : (
                    <Chart
                      type="bar"
                      height={350}
                      series={[
                        {
                          name: "USED (%)",
                          data: locationByRackType.used,
                        },
                        {
                          name: "REMAIN (%)",
                          data: locationByRackType.remain,
                        },
                      ]}
                      options={{
                        chart: {
                          type: "bar",
                          stacked: true,
                          toolbar: {
                            show: false,
                          },
                        },
                        colors: ["#4A90E2", "#50C878"],
                        plotOptions: {
                          bar: {
                            horizontal: false,
                            columnWidth: "50%",
                          },
                        },
                        xaxis: {
                          categories: locationByRackType.rackTypes,
                          title: {
                            text: "RACK TYPE",
                          },
                        },
                        yaxis: {
                          title: {
                            text: "",
                          },
                          min: 0,
                          max: 120,
                          tickAmount: 6,
                        },
                        grid: {
                          borderColor: "#e0e0e0",
                          strokeDashArray: 0,
                        },
                        legend: {
                          position: "top",
                          horizontalAlign: "right",
                        },
                        tooltip: {
                          shared: true,
                          intersect: false,
                        },
                        dataLabels: {
                          enabled: false,
                        },
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Pallets Age Cards */}
            <div
              className="col-md-4 col-sm-12 mb-3"
              style={{
                display: "flex",
                flexDirection: "column",
                height: "430px",
              }}
            >
              {/* Less Than 6 Months - Green */}
              <div style={{ flex: 1, marginBottom: "12px", display: "flex" }}>
                <div
                  className="dashboard-card"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      backgroundColor: "#50C878",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "20px",
                      flexShrink: 0,
                    }}
                  >
                    <FaBell size={32} color="#fff" />
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "20px" }}>
                    <div
                      style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        color: "#50C878",
                      }}
                    >
                      {loading ? "..." : palletsLessThan6Months.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "16px", color: "#666" }}>
                      LESS THAN 6 MONTHS (PALLETS)
                    </div>
                  </div>
                </div>
              </div>

              {/* 6 Months - 12 Months - Blue */}
              <div style={{ flex: 1, marginBottom: "12px", display: "flex" }}>
                <div
                  className="dashboard-card"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      backgroundColor: "#4A90E2",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "20px",
                      flexShrink: 0,
                    }}
                  >
                    <FaBell size={32} color="#fff" />
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "20px" }}>
                    <div
                      style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        color: "#4A90E2",
                      }}
                    >
                      {loading ? "..." : pallets6To12Months.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "16px", color: "#666" }}>
                      6 MONTHS - 12 MONTHS (PALLETS)
                    </div>
                  </div>
                </div>
              </div>

              {/* More Than 12 Months - Red */}
              <div style={{ flex: 1, display: "flex" }}>
                <div
                  className="dashboard-card"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      backgroundColor: "#E74C3C",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "20px",
                      flexShrink: 0,
                    }}
                  >
                    <FaBell size={32} color="#fff" />
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "20px" }}>
                    <div
                      style={{
                        fontSize: "48px",
                        fontWeight: "bold",
                        color: "#E74C3C",
                      }}
                    >
                      {loading ? "..." : palletsMoreThan12Months.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "16px", color: "#666" }}>
                      MORE THAN 12 MONTHS (PALLETS)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction 7 Days Chart and Location by RackType - New Boxes */}
          <div
            className="row"
            style={{
              marginTop: "20px",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap",
            }}
          >

            {/* Left Column - Bar Chart (Original - Empty) */}
            <div className="col-md-8 col-sm-12 mb-3">
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "20px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  minHeight: "400px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#333",
                  }}
                >
                  EMPTY BOX
                </h3>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed #ccc",
                    borderRadius: "4px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  <span style={{ color: "#999", fontSize: "14px" }}>Chart placeholder</span>
                </div>
              </div>
            </div>

            {/* Empty Box */}
            <div className="col-md-4 col-sm-12 mb-3" style={{ display: "flex" }}>
              <div
                className="dashboard-card"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "20px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  minHeight: "400px",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "20px",
                    color: "#333",
                  }}
                >
                  EMPTY BOX
                </h3>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed #ccc",
                    borderRadius: "4px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  <span style={{ color: "#999", fontSize: "14px" }}>Empty placeholder</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

