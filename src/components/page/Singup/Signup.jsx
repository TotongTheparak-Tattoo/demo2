import React, { useState, useEffect, useRef } from "react";
import { httpClient } from "../../../utils/HttpClient";
import "./Signup.css";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

export default function Signup () {
  const [formData, setFormData] = useState({
    emp_no: "",
    password: "",
    repassword: "",
    email: "",
    divisionId: "",
    level_id: "",
    role_id: "",
  });

  const signupNoInputRef = useRef(null);
  const [divisions, setDivisions] = useState([]);
  const [role, setRole] = useState([]);
  const [level, setLevel] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showCFPassword, setShowCFPassword] = useState(false);

  useEffect(() => {
    signupNoInputRef.current.focus();
    getDivision();
    getRole();
    getLevel();
  }, []);


 const getDivision = async () => {
    // #region get Division
    try {
      const response = await httpClient.get(`/api/v1/division/get_division`);
      const valuesArray = Object.values(response.data.result).map((item) => ({
        name: item.divisionName,
        Id: item.divisionId,
      }));
      console.log(response);
      switch (response.status) {
        case 500:
          Swal.fire({
            title: "Info!",
            text: response.data.detail,
            icon: "info",
            timer: 2000,
            timerProgressBar: true,
          });
          break;

        case 200:
          setDivisions(valuesArray);
          break;

        default:
          break;
      }
    } catch (error) {
      console.log("Error", "Failed to fetch data division", "error");
    }
  };

  const getRole = async () => {
  // #region get role
    try {
      const response = await httpClient.get(`/api/v1/authen/get_role`);
      const valuesArray = Object.values(response.data.result).map((item) => ({
        role_id: item.roleId,
        role_name: item.roleName,
      }));
      console.log(response.data);
      switch (response.status) {
        case 500:
          Swal.fire({
            title: "Info!",
            text: response.data.detail,
            icon: "info",
            timer: 2000,
            timerProgressBar: true,
          });
          break;

        case 200:
          setRole(valuesArray);
          break;

        default:
          break;
      }
    } catch (error) {
      Swal.fire("Try Again", "Failed to fetch data role", "info");
    }
  };
  const getLevel = async () => {
  // #region get level
    try {
      const response = await httpClient.get(`/api/v1/authen/get_level`);
      const valuesArray = Object.values(response.data.result).map((item) => ({
        levelId: item.levelId,
        levelName: item.levelName,
      }));
      console.log(response.data);
      switch (response.status) {
        case 500:
          Swal.fire({
            title: "Info!",
            text: response.data.detail,
            icon: "info",
            timer: 2000,
            timerProgressBar: true,
          });
          break;

        case 200:
          setLevel(valuesArray);
          break;

        default:
          break;
      }
    } catch (error) {
      Swal.fire("Try Again", "Failed to fetch data level", "info");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const serverSignup = await httpClient.post("/api/v1/authen/signup", formData);

      switch (serverSignup.status) {
        case 500:
          Swal.fire({
            title: "Info!",
            text: serverSignup.data.result,
            icon: "info",
            timer: 2000,
            timerProgressBar: true,
          });
          break;
        case 201:
          Swal.fire({
            icon: "success",
            title: "Signup Successful",
            text: serverSignup.data.result,
            timer: 2500,
            timerProgressBar: true,
          });
          break;

        default:
          break;
      }

      setFormData({
        emp_no: "",
        password: "",
        repassword: "",
        email: "",
        divisionId: "",
        role_id: "",
        level_id: "",
      });
      setShowPassword(false);
      setShowCFPassword(false);
    } catch (error) {
      setFormData({
        emp_no: "",
        password: "",
        repassword: "",
        email: "",
        divisionId: "",
        role_id: "",
        level_id: "",

      });
      console.log("Error", error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  const toggleConfirmPasswordVisibility = () => {
    setShowCFPassword(!showCFPassword);
  };

  return (
    <>
      <div className="signuppage">
        <div className="signuppagecard">
          <form className="form-signup" onSubmit={handleSubmit}>
            <p className="h4-signup">Sign Up</p>
            <div className="mb-3" style={{ textAlign: "left" }}>
              <input
                type="text"
                name="emp_no"
                className="form-control text_area"
                placeholder="Employee"
                value={formData.emp_no}
                maxLength={5}
                onChange={handleChange}
                ref={signupNoInputRef}
              />
            </div>
            <div
              className="password-container-signup"
              style={{
                display: "flex",
                alignItems: "center",
                position: "relative",
              }}
            >
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-control text_area"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
              <span
                className="toggle-password-signup-pass"
                style={{ marginTop: "6px" }}
                onClick={togglePasswordVisibility}
              >
                {showPassword ? (
                  <FontAwesomeIcon icon={faEye} />
                ) : (
                  <FontAwesomeIcon icon={faEyeSlash} />
                )}
              </span>
            </div>
            <div
              className="password-container-signup"
              style={{
                display: "flex",
                alignItems: "center",
                position: "relative",
              }}
            >
              <input
                type={showCFPassword ? "text" : "password"}
                name="repassword"
                className="form-control text_area"
                placeholder="Confirm Password"
                value={formData.repassword}
                onChange={handleChange}
                style={{ flex: 1, paddingRight: "40px" }}
              />
              <span
                className="toggle-password-signup-cf-pass"
                onClick={toggleConfirmPasswordVisibility}
              >
                {showCFPassword ? (
                  <FontAwesomeIcon icon={faEye} />
                ) : (
                  <FontAwesomeIcon icon={faEyeSlash} />
                )}
              </span>
            </div>

            <div className="mb-3" style={{ textAlign: "left" }}>
              <input
                type="email"
                name="email"
                className="form-control text_area"
                placeholder="example@minebea.co.th"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="mb-3" style={{ textAlign: "left" }}>
              <select
                name="divisionId"
                className="form-control text_area"
                value={formData.divisionId}
                onChange={handleChange}
              >
                <option value={""}>Select Division</option>
                {divisions.map((division, index) => (
                  <option key={index} value={division.Id}>
                    {division.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3" style={{ textAlign: "left" }}>
              <select
                name="role_id"
                className="form-control text_area"
                value={formData.role_id}
                onChange={handleChange}
              >
                <option value={""}>Select Role</option>
                {role.map((item, index) => (
                      <option key={index} value={item.role_id}>
                        {item.role_name}
                      </option>
                    )
                )}
              </select>
            </div>
            <div className="mb-3" style={{ textAlign: "left" }}>
              <select
                name="level_id"
                className="form-control text_area"
                value={formData.level_id}
                onChange={handleChange}
              >
                <option value={""}>Select Level</option>
                {level.map((item, index) => (
                      <option key={index} value={item.levelId}>
                        {item.levelName}
                      </option>
                    )
                )}
              </select>
            </div>

            <button type="submit" className="btnsignup btn btn-primary">
              Sign Up
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                fontSize: "20px",
              }}
            >
              Already member <Link to="/login"> &nbsp;Login</Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

