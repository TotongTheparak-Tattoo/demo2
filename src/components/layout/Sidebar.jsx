import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaHome, FaRegListAlt, FaSearchLocation, FaList } from "react-icons/fa";
import { FaFileCsv } from "react-icons/fa6";
import {
  MdPallet,
  MdOutlineInventory,
  MdAdminPanelSettings,
  MdFactCheck,
  MdAddLocationAlt,
  MdEditLocationAlt,
  MdWrongLocation,
  MdLocationOn,
  MdWarehouse,
  MdInventory,
} from "react-icons/md";
import { BsDatabaseFillUp } from "react-icons/bs";
import { SiAdguard } from "react-icons/si";
import { IoBackspaceOutline } from "react-icons/io5";
import { MdReport } from "react-icons/md";
import { RiUpload2Fill } from "react-icons/ri";
import { HiDocumentReport } from "react-icons/hi";
import { RiHomeOfficeLine } from "react-icons/ri";
import { FaUserGear } from "react-icons/fa6";
import { IoMdCloseCircleOutline } from "react-icons/io";
import { IoMdMove } from "react-icons/io";
import { FcMultipleInputs } from "react-icons/fc";
import { FiUpload } from "react-icons/fi";
import { TbTruckLoading } from "react-icons/tb";
import { HiMiniUserGroup, HiPrinter } from "react-icons/hi2";
import { MdTableChart } from "react-icons/md";
import { useRole } from "../../RoleContext";
import { jwtDecode } from "jwt-decode";
import { key } from "../../constance/constance";

const Sidebar = () => {
  const token = localStorage.getItem(key.TOKEN);
  let decoded = null;
  if (token) {
    try {
      decoded = jwtDecode(token);
    } catch (error) {
      console.error("Invalid token:", error);
    }
  }

  let level_name = "";
  if (decoded !== null && decoded !== undefined) {
    if (decoded.levelName !== null && decoded.levelName !== undefined) {
      level_name = decoded.levelName;
    }
  }
  const { role } = useRole();
  const level = level_name;

  console.log("side bar role:", role);
  console.log("side bar level:", level);

  return (
    <aside
      className="main-sidebar sidebar-dark-primary sidebar-no-expand"
      style={{ fontSize: "12px" }}
    >
      <div className="sidebar ">
        <nav className="mt-2">
          <ul
            className="nav nav-pills nav-sidebar flex-column nav-child-indent"
            data-widget="treeview"
            role="menu"
            data-accordion="false"
          >
            {/* Home */}

            <li className="nav-item ">
              <Link
                to="/vmi-dashboard"
                className="nav-link"
                style={{ borderRadius: "7px" }}
              >
                <FaHome size={20} style={{ marginBottom: "4px" }} />
                <p style={{ marginLeft: "8px" }}>HOME</p>
              </Link>
            </li>
            {/* Admin */}
            <li className="nav-item menu-is-opening menu-open">
              {(level === "admin") && (
                <ul className="nav nav-treeview" style={{ display: "block" }}>
                  {/* user management */}
                  <li className="nav-item menu-open">
                    <Link
                      to="#"
                      className="nav-link"
                      style={{ borderRadius: "7px" }}
                    >
                      <SiAdguard size={20} style={{ marginBottom: "4px" }} />
                      <p style={{ marginLeft: "8px" }}>
                        Administrator
                        <i className="right fas fa-angle-left" />
                      </p>
                    </Link>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-usermanagement" className="nav-link">
                          <FaUserGear size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>User Management</p>
                        </Link>

                      </li>
                    </ul>
                  </li>
                </ul>
              )}
            </li>
            {/* Master */}
            <li className="nav-item menu-is-opening menu-open">
              {(level === "admin") && (
                <ul className="nav nav-treeview" style={{ display: "block" }}>
                  {/* user management */}
                  <li className="nav-item menu-open">
                    <Link
                      to="#"
                      className="nav-link"
                      style={{ borderRadius: "7px" }}
                    >
                      <BsDatabaseFillUp size={20} style={{ marginBottom: "4px" }} />
                      <p style={{ marginLeft: "8px" }}>
                        Master
                        <i className="right fas fa-angle-left" />
                      </p>
                    </Link>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-itemlistupload" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Upload ItemList</p>
                        </Link>
                      </li>
                    </ul>
                    {/* <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-entry-upload" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Upload Entry No</p>
                        </Link>
                      </li>
                    </ul> */}
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-vendorupload" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Upload Vender</p>
                        </Link>
                      </li>
                    </ul>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-upload-monthly" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Upload Monthly</p>
                        </Link>
                      </li>
                    </ul>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-upload-transaction-movement" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Upload Transaction Movement</p>
                        </Link>
                      </li>
                    </ul>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-edit-monthly-data" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Edit Monthly Data</p>
                        </Link>
                      </li>
                    </ul>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        <Link to="/vmi-edit-transaction-movement" className="nav-link">
                          <RiUpload2Fill size={20} style={{ marginBottom: "4px" }} />
                          <p style={{ marginLeft: "8px" }}>Edit Transaction Movement</p>
                        </Link>
                      </li>
                    </ul>
                  </li>
                </ul>
              )}
            </li>
            <>
              {/* Vendor */}
              {(level === "admin" || level === "staff") && (
                <li className="nav-item menu-is-opening menu-open">
                  <ul className="nav nav-treeview" style={{ display: "block" }}>
                    {/* Upload */}
                    <li className="nav-item menu-open">
                      <Link
                        to="#"
                        className="nav-link"
                        style={{ borderRadius: "7px" }}
                      >
                        <HiMiniUserGroup size={20} style={{ marginBottom: "4px" }} />
                        <p style={{ marginLeft: "8px" }}>
                          Vendor
                          <i className="right fas fa-angle-left" />
                        </p>
                      </Link>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link to="/vmi-vendor-upload" className="nav-link">
                            <FiUpload size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Upload Invoice</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to="/vmi-vendor-status4" className="nav-link">
                            <MdInventory size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Delete Invoice</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to="/vmi-itemlist" className="nav-link">
                            <MdTableChart size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Item List</p>
                          </Link>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </li>
              )}
              {/* Export */}
              <li className="nav-item menu-is-opening menu-open">
                <ul className="nav nav-treeview" style={{ display: "block" }}>
                  {/* Inbound */}
                  <li className="nav-item menu-open">
                    <Link
                      to="#"
                      className="nav-link"
                      style={{ borderRadius: "7px" }}
                    >
                      <MdWarehouse size={20} style={{ marginBottom: "4px" }} />
                      <p style={{ marginLeft: "8px" }}>
                        Inbound
                        <i className="right fas fa-angle-left" />
                      </p>
                    </Link>
                    {(level === "admin" || level === "staff" || level === "operator") && (
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link to="/vmi-inbound-receive" className="nav-link">
                            <MdPallet size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Receive</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to="/vmi-inbound-putaway" className="nav-link">
                            <FcMultipleInputs
                              size={20}
                              style={{ marginBottom: "4px" }}
                            />
                            <p style={{ marginLeft: "8px" }}>Put Away</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to="/vmi-inbound-reprint" className="nav-link">
                            <HiPrinter
                              size={20}
                              style={{ marginBottom: "4px" }}
                            />
                            <p style={{ marginLeft: "8px" }}>Reprint</p>
                          </Link>
                        </li>
                      </ul>
                    )}
                  </li>
                  {/* Outbound */}
                  <li className="nav-item menu-open">
                    <Link to="#" className="nav-link" style={{ borderRadius: "7px" }}>
                      <TbTruckLoading size={20} style={{ marginBottom: "4px" }} />
                      <p style={{ marginLeft: "8px" }}>
                        Outbound
                        <i className="right fas fa-angle-left" />
                      </p>
                    </Link>
                    <ul className="nav nav-treeview">
                      {(level === "admin" || level === "staff") && (
                        <li className="nav-item">
                          <Link to="/vmi-mr-upload" className="nav-link">
                            <FaRegListAlt size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Upload MR</p>
                          </Link>
                        </li>
                      )}
                      <li className="nav-item">
                        {(level === "admin" || level === "staff" || level === "operator") && (
                          <Link to="/vmi-picking" className="nav-link">
                            <MdOutlineInventory size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Picking</p>
                          </Link>
                        )}
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>

              {/* move location */}
              <li className="nav-item menu-is-opening menu-open">
                <ul className="nav nav-treeview" style={{ display: "block" }}>
                  <li className="nav-item menu-open">
                    <Link to="#" className="nav-link" style={{ borderRadius: "7px" }}>
                      <IoMdMove size={20} style={{ marginBottom: "4px" }} />
                      <p style={{ marginLeft: "8px" }}>Move Location<i className="right fas fa-angle-left" /></p>
                    </Link>
                    <ul className="nav nav-treeview">
                      <li className="nav-item">
                        {(level === "admin" || level === "staff" || level === "operator") && (
                          <Link to="/vmi-move-location" className="nav-link">
                            <IoMdMove size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Move Location</p>
                          </Link>
                        )}
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>


              {/* Void */}
              <li className="nav-item menu-is-opening menu-open">
                {(level === "admin" || level === "staff" || level === "operator") && (
                  <ul className="nav nav-treeview" style={{ display: "block" }}>
                    <li className="nav-item menu-open">
                      <Link to="#" className="nav-link" style={{ borderRadius: "7px" }}>
                        <IoMdCloseCircleOutline size={20} style={{ marginBottom: "4px" }} />
                        <p style={{ marginLeft: "8px" }}>
                          Void
                          <i className="right fas fa-angle-left" />
                        </p>
                      </Link>

                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link to="/vmi-void-process" className="nav-link">
                            <IoBackspaceOutline size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Void Process</p>
                          </Link>
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link to="/vmi-void-mr" className="nav-link">
                            <IoBackspaceOutline size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Void MrRequest</p>
                          </Link>
                        </li>
                      </ul>
                    </li>
                  </ul>
                )}
              </li>


              {/* Report */}
                <li className="nav-item menu-is-opening menu-open">
                  <ul className="nav nav-treeview" style={{ display: "block" }}>
                    <li className="nav-item menu-open">
                      <Link to="#" className="nav-link" style={{ borderRadius: "7px" }}>
                        <MdReport size={20} style={{ marginBottom: "4px" }} />
                        <p style={{ marginLeft: "8px" }}>
                          Report
                          <i className="right fas fa-angle-left" />
                        </p>
                      </Link>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        
                          <Link to="/vmi-inventory" className="nav-link">
                            <RiHomeOfficeLine size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>WareHouse Layout</p>
                          </Link>
              
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link to="/vmi-report-product-log" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Transaction Log</p>
                          </Link>
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-mr-request-log" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>MrRequest Log</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      {/* <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link to="/vmi-report-stock-in-out" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Stock In-Out Report</p>
                          </Link>
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-monthly-data-log" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Monthly Data Log</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-transaction-movement-log" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Transaction Movement Log</p>
                          </Link>
                        )}
                        </li>
                      </ul> */}
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-stock-movement" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Stock Movement</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-menu" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Logistics Report</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      {/* <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-monthly-report" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Monthly Report</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-transaction-movement-report" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>คทบ.18 Report</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-balance-report" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>คทบ.17 Report</p>
                          </Link>
                        )}
                        </li>
                      </ul>
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                        {(level === "admin" || level === "staff") && (
                          <Link to="/vmi-report-billing" className="nav-link">
                            <HiDocumentReport size={20} style={{ marginBottom: "4px" }} />
                            <p style={{ marginLeft: "8px" }}>Billing</p>
                          </Link>
                        )}
                        </li>
                      </ul> */}
                    </li>
                  </ul>
                </li>
            </>
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
