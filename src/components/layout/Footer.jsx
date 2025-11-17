import React from "react";
import { Link, useLocation } from "react-router-dom";

const Footer = () => {
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

    if (isAuthPage) {
      return null;
    }
  return (
    <footer
      // className={`footer ${
      //   !isAuthPage ? "main-footer" : ""
      // }`}
      className={`main-footer`}
      style={{
        backgroundColor: "#A4A5A6",
        color: "black",
        borderRadius: "0.2rem",
      }}
    >
      <strong>
        Warehouse Management System Copyright &copy; 2025
        <Link style={{ color: "blue" }}>  Developed by MIC DIV. </Link>
      </strong>
      <div className="float-right d-none d-sm-inline-block">
        <b>Version</b> 1.2.3 Vendor Managed Inventory
      </div>
    </footer>
  );
};

export default Footer;
