import React, { useState, useEffect } from "react";
import { key } from "../../constance/constance";
import { httpClient } from "../../utils/HttpClient";
import { Link, useLocation } from "react-router-dom";
import { FaUser } from "react-icons/fa";
import { IoLogIn, IoLogOut } from "react-icons/io5";
import { jwtDecode } from "jwt-decode";
const Header = () => {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem(key.LOGIN_PASSED) === "PASSED"
  );

  const token = localStorage.getItem(key.TOKEN);

  let decoded = null;
  if (token) {
    try {
      decoded = jwtDecode(token);
    } catch (error) {
      console.error("Invalid token:", error);
    }
  }

  let empNo = "";
  if (decoded !== null && decoded !== undefined) {
    if (decoded.empNo !== null && decoded.empNo !== undefined) {
      empNo = decoded.empNo;
    }
  }

  const [userId, setUserId] = useState(empNo.toUpperCase());

  useEffect(() => {
    const checkTimeout = () => {
      const loginTime = parseInt(localStorage.getItem("LOGIN_TIME"), 10);
      if (loginTime) {
        const now = new Date().getTime();
        // const threeDays = 1 * 24 * 60 * 60 * 1000;
        const threeDays = 3 * 24 * 60 * 60 * 1000;  // 3 days  3 * 24 * 60 * 60 * 1000;
        if (now - loginTime > threeDays) { 
          ClickLogout();
        }
      }
    };

    // Check on component mount
    checkTimeout();

    // Optional: set interval to regularly check, if desired
    const interval = setInterval(checkTimeout, 1000 * 60); // Check every minute

    // Clear interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const ClickLogout = async () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUserId("");
    window.location.replace("/login");
  };

  const buttonStyle = {
    backgroundColor: "#115F95",
    color: "white",
    border: "none",
    padding: "8px 10px",
    fontSize: "16px",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
  };

  const buttonHoverStyle = {
    backgroundColor: "#115F95",
  };

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  if (isAuthPage) {
    return null;
  }

  return (
    <>
      <nav
        className={`navbar navbar-expand navbar-info navbar-light ${
          !isAuthPage ? "main-header" : ""
        }`}
        style={{ backgroundColor: "#115F95", fontSize: "16px" }}
      >
        {/* <Link className="brand-link " to="/home">
          <img
            src="dist/img/wms_logo.png"
            alt="MinebeaMitsumi Logo"
            className="brand-image img-squre "
            style={{ opacity: "1" }}
          />
        </Link> */}

        {/* Left navbar links */}
        <ul className="navbar-nav">
          <li className="nav-item">
            <Link
              className="nav-link"
              data-widget="pushmenu"
              to="#"
              role="button"
            >
              <i
                style={{ color: "#fff", fontSize: "20px" }}
                className="fas fa-bars"
              />
            </Link>
          </li>
        </ul>

        {/* Right navbar links */}
        <ul className="navbar-nav ml-auto">
          {isLoggedIn ? (
            <>
              <li className="nav-item">
                <span
                  className="nav-link"
                  style={{
                    color: "white",
                    marginRight: "10px",
                    paddingTop: "8px",
                    marginBottom: "2px",
                  }}
                >
                  <FaUser size={20} /> {userId.toUpperCase()}
                </span>
              </li>
              <li className="nav-item">
                <button
                  className="nav-link"
                  style={buttonStyle}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      buttonHoverStyle.backgroundColor)
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      buttonStyle.backgroundColor)
                  }
                  onClick={ClickLogout}
                >
                  <IoLogOut style={{ marginBottom: "2px" }} size={20} /> LOGOUT
                </button>
              </li>
            </>
          ) : (
            <li className="nav-item">
              <Link
                className="nav-link"
                to="/login"
                style={buttonStyle}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    buttonHoverStyle.backgroundColor)
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    buttonStyle.backgroundColor)
                }
              >
                <IoLogIn style={{ marginBottom: "2px" }} size={20} /> LOGIN
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
};

export default Header;
