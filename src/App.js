import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import "./App.css";
import { key } from "./constance/constance";

// --------------------------- sidebar, footer, header--------------------------
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";

// ----------------------------Page--------------------------------------------
import AccessDenied from "./components/page/AccessDenied/AccessDenied"
import Login from "./components/page/Login/Login";
import Signup from "./components/page/Singup/Signup";

// -----------------------------------Vendor----------------------------------
import UploadInvoice from "./components/page/Vendor/UploadInvoice";
import Status4Inventory from "./components/page/Vendor/Status4Inventory";

// -----------------------------------Item List----------------------------------
import ItemList from "./components/page/ItemList/ItemList";

// -----------------------------------Administrator----------------------------------

// -----------------------------------inbound----------------------------------
import Receive from "./components/page/Inbound/Receive";
import InboundReprint from "./components/page/InboundReprint/InboundReprint";
import Putaway from "./components/page/Putaway/Putaway";
// -----------------------------------masterData----------------------------------
import VendorUpload from "./components/page/Master/VendorUpload";
import ItemListUpload from "./components/page/Master/ItemListUpload";
import UploadMonthly from "./components/page/Master/UploadMonthly";
import UploadTransactionMovement from "./components/page/Master/UploadTransactionMovement";
// -----------------------------------outbound----------------------------------
import MrUpload from "./components/page/RequestPicking/RequestPicking";
import Picking from "./components/page/PickingProductBalance/PickingProductBalance";
// -----------------------------------void----------------------------------
import VoidProcess from "./components/page/Void/VoidProcess";
import ScanVoid from "./components/page/ScanVoid/ScanVoid";
import VoidMrRequest from "./components/page/VoidMrRequest/VoidMrRequest";
// -----------------------------------Inventory----------------------------------
import MoveLocation from "./components/page/MoveLocation/MoveLocation";
//--------------------------------------Report--------------------------------------------
import MrRequestLog from "./components/page/MrRequestLog/MrRequestLog";
import ProductLog from "./components/page/ProductLog/ProductLog";
import Inventory from "./components/page/Inventory/Inventory";
import StockInOut from "./components/page/StockInOut/StockInOut";
import EntryNoUpload from "./components/page/Master/EntryNoUpload";
import MonthlyDataLog from "./components/page/MonthlyDataLog/MonthlyDataLog";
import TransactionMovementLog from "./components/page/TransactionMovementLog/TransactionMovementLog";
import EditMonthlyData from "./components/page/EditMonthlyData/EditMonthlyData";
import EditTransactionMovement from "./components/page/EditTransactionMovement/EditTransactionMovement";
import MonthlyReport from "./components/page/MonthlyReport/MonthlyReport";
import TransactionMovementReport from "./components/page/TransactionMovementReport/TransactionMovementReport";
import BalanceReport from "./components/page/BalanceReport/BalanceReport";
import BalanceReportBySize from "./components/page/BalanceReportBySize/BalanceReportBySize";
import Billing from "./components/page/Billing/Billing";
import ReportMenu from "./components/page/ReportMenu/ReportMenu";
import StockMovement from "./components/page/StockMovement/StockMovement";
import Dashboard from "./components/page/Dashboard/Dashboard";

import UserManagement from "./components/page/UserManagement/UserManagement";

import { RoleProvider } from "./RoleContext";
import { jwtDecode } from "jwt-decode";


const AppContent = () => {
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState(location.pathname);
  const token = localStorage.getItem(key.TOKEN);
  const hideSidebar = currentPath === "/login" || currentPath === "/signup";
  const isLoggedin = () => { return localStorage.getItem(key.LOGIN_PASSED) === "PASSED"; };
  let decoded = null;
  let signupStatus = "";

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

  // Decode token if exists
  if (token) {
    try {
      decoded = jwtDecode(token);
      if (decoded && decoded.signupStatus) {
        signupStatus = decoded.signupStatus;
      }
    } catch (error) {
      console.error("Invalid token:", error);
      // Clear invalid token
      localStorage.removeItem(key.TOKEN);
      localStorage.removeItem(key.LOGIN_PASSED);
    }
  }

  return (
    <div>
      <Header />
      {!hideSidebar && <Sidebar />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        {token && signupStatus === "activate" ? (
          <>
            <Route path="/" element={<Navigate to="/vmi-dashboard" replace />} />
            <Route path="/vmi-dashboard" element={<Dashboard />} />
            <Route path="/vmi-vendor-upload" element={<UploadInvoice />} />
            <Route path="/vmi-vendor-status4" element={<Status4Inventory />} />
            <Route path="/vmi-itemlist" element={<ItemList />} />
            <Route path="/vmi-inbound-receive" element={<Receive />} />
            <Route path="/vmi-inbound-reprint" element={<InboundReprint />} />
            <Route path="/vmi-inbound-putaway" element={<Putaway />} />
            <Route path="/vmi-mr-upload" element={<MrUpload />} />
            <Route path="/vmi-picking" element={<Picking />} />
            <Route path="/vmi-void-process" element={<VoidProcess />} />
            <Route path="/vmi-void-scan" element={<ScanVoid />} />
            <Route path="/vmi-report-mr-request-log" element={<MrRequestLog />} />
            <Route path="/vmi-report-product-log" element={<ProductLog />} />
            <Route path="/vmi-report-monthly-data-log" element={<MonthlyDataLog />} />
            <Route path="/vmi-report-transaction-movement-log" element={<TransactionMovementLog />} />
            <Route path="/vmi-report-stock-in-out" element={<StockInOut />} />
            <Route path="/vmi-void-mr" element={<VoidMrRequest />} />
            <Route path="/vmi-move-location" element={<MoveLocation />} />
            <Route path="/vmi-inventory" element={<Inventory />} />
            <Route path="/vmi-entry-upload" element={<EntryNoUpload />} />
            <Route path="/vmi-usermanagement" element={<UserManagement />} />
            <Route path="/vmi-vendorupload" element={<VendorUpload />} />
            <Route path="/vmi-itemlistupload" element={<ItemListUpload />} />
            <Route path="/vmi-upload-monthly" element={<UploadMonthly />} />
            <Route path="/vmi-upload-transaction-movement" element={<UploadTransactionMovement />} />
            <Route path="/vmi-edit-monthly-data" element={<EditMonthlyData />} />
            <Route path="/vmi-edit-transaction-movement" element={<EditTransactionMovement />} />
            <Route path="/vmi-report-menu" element={<ReportMenu />} />
            <Route path="/vmi-report-monthly-report" element={<MonthlyReport />} />
            <Route path="/vmi-report-transaction-movement-report" element={<TransactionMovementReport />} />
            <Route path="/vmi-report-balance-report" element={<BalanceReport />} />
            <Route path="/vmi-report-balance-report-by-size" element={<BalanceReportBySize />} />
            <Route path="/vmi-report-billing" element={<Billing />} />
            <Route path="/vmi-report-stock-movement" element={<StockMovement />} />
          </>
        ) : token && signupStatus === "deactivate" ? (
          <Route path="*" element={<Navigate to="/access-denied" replace />} />
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
      <Footer />
    </div>
  );
};

const App = () => {
  return (
    <RoleProvider>
      <Router>
        <AppContent />
      </Router>
    </RoleProvider>
  );
};

export default App;
