import React from "react";
import { Link } from "react-router-dom";
import "./ReportMenu.css";

export default function ReportMenu() {
  const reports = [
    {
      path: "/vmi-report-monthly-report",
      title: "Monthly Report",
      description: "รายงานการนำของเข้าเก็บในคลังสินค้าทัณฑ์บน (Monthly Report)",
      icon: "📊",
    },
    {
      path: "/vmi-report-transaction-movement-report",
      title: "คทบ.18 Report",
      description: "รายงานการเคลื่อนไหวของสินค้า (คทบ.18)",
      icon: "📋",
    },
    {
      path: "/vmi-report-balance-report",
      title: "คทบ.17 Report",
      description: "รายงานยอดคงเหลือสินค้า (คทบ.17)",
      icon: "📈",
    },
    {
      path: "/vmi-report-balance-report-by-size",
      title: "Summary Stock card Report",
      description: "รายงานยอดคงเหลือแยกตาม Size",
      icon: "📊",
    },
    {
      path: "/vmi-report-billing",
      title: "Billing",
      description: "รายงานการเรียกเก็บเงิน (Billing Report)",
      icon: "💰",
    },
    {
      path: "/vmi-report-stock-in-out",
      title: "Stock In/Out",
      description: "รายงานการนำเข้า-นำออกสินค้า",
      icon: "📦",
    },
    {
      path: "/vmi-report-monthly-data-log",
      title: "Monthly Data Log",
      description: "บันทึกข้อมูลรายเดือน",
      icon: "📅",
    },
    {
      path: "/vmi-report-transaction-movement-log",
      title: "Transaction Movement Log",
      description: "บันทึกการเคลื่อนไหวของธุรกรรม",
      icon: "🔄",
    },
  ];

  return (
    <div className="wrapper" style={{ overflowX: "hidden" }}>
      <div className="content-wrapper">
        <div className="container-fluid">
          <div className="row">
            <div className="col" style={{ marginTop: "5px" }}>
              <ol className="breadcrumb float-mb-left angle">
                <li className="breadcrumb-item">REPORT</li>
                <li className="breadcrumb-item">
                  <Link to="#" className="color-link">Logistics Report</Link>
                </li>
              </ol>
            </div>
          </div>

          <div className="card angle gap-margin">
            <div className="card-header card-void" style={{ textAlign: "center" }}>
              Logistics Report
            </div>

            <div className="card-body gap-margin">
              <div className="report-menu-grid">
                {reports.map((report) => (
                  <Link
                    key={report.path}
                    to={report.path}
                    className="report-menu-card"
                  >
                    <div className="report-menu-icon">{report.icon}</div>
                    <div className="report-menu-title">{report.title}</div>
                    <div className="report-menu-description">{report.description}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

