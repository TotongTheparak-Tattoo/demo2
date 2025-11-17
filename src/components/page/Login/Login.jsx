import React, { useState, useEffect, useRef } from "react";
import { httpClient } from "../../../utils/HttpClient";
import { key } from "../../../constance/constance";
import "./Login.css";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { jwtDecode } from "jwt-decode";

export default function Login ()  {
  const [empNo, setEmpNo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const empNoInputRef = useRef(null);

  useEffect(() => {
    empNoInputRef.current.focus();
  }, []);

  const ClickLogin = async (e) => {
    e.preventDefault();
try{
    let responeLogin = await httpClient.post(`/api/v1/authen/login`, {
      emp_no: empNo,
      password: password,
    });

    switch (responeLogin.status) {
      case 500:
        Swal.fire({
          title: responeLogin.data.detail,
          icon: "warning",
        });
        setPassword("")
        break;
      case 200:
        try {
            const decoded = jwtDecode(responeLogin.data.token);
            if (decoded.signupStatus === "deactivate") {
              Swal.fire({
                title: "Account Not Activated",
                text: "Please contact the administrator to activate your account.",
                icon: "warning",
                confirmButtonText: "Got it."
              });
              setPassword("");
              return; 
            }
            localStorage.setItem(key.LOGIN_PASSED, "PASSED");
            localStorage.setItem(key.TOKEN, responeLogin.data.token);
            localStorage.setItem("LOGIN_TIME", new Date().getTime());
            window.location.replace("/vmi-inbound-receive");
            
          } catch (tokenError) {
            console.error("Error decoding token:", tokenError);
            Swal.fire({
              title: "An authentication error occurred.",
              text: "Please contact the administrator.",
              icon: "error",
            });
            setPassword("");
          }
          break;
      default:
        break;
    }
  }
  catch (error) {
    setPassword("")
    console.log("Error", error);
  };
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="loginpage">
      <div className="loginpagecard">
        <form className="form-login" onSubmit={ClickLogin}>
          <p className="h4-login">
            Login  WMS <br></br>Vendor Managed Inventory<br></br>
          </p>
          <div className="mb-3" style={{ textAlign: "left" }}>
            <input
              type="text"
              id="emp_no"
              name="emp_no"
              className="form-control text_area_empno"
              placeholder="Employee"
              maxLength={5}
              value={empNo}
              onChange={(e) => setEmpNo(e.target.value)}
              ref={empNoInputRef}
            />
          </div>

          <div
            className="mb-3 password-container-login"
            style={{ textAlign: "left" }}
          >
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              className="form-control text_area_pass"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="toggle-password-login"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? (
                <FontAwesomeIcon icon={faEye} />
              ) : (
                <FontAwesomeIcon icon={faEyeSlash} />
              )}
            </span>
          </div>
          <div>
            <br></br>
          </div>
          <button type="submit" className="btnlogin btn btn-primary">
            Submit
          </button>
          <div
            className="text-center mt-3"
            style={{ fontSize: "20px", fontWeight: "bold" }}
          >
            Don't have an account?
            <Link to="/signup">&nbsp; Sign Up</Link>
          </div>
        </form>
      </div>
    </div>
  );
};
