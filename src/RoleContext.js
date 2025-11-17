import React, { createContext, useContext, useState, useEffect } from 'react';
import { key } from './constance/constance';
import { jwtDecode } from "jwt-decode";

const token = localStorage.getItem(key.TOKEN);

const RoleContext = createContext();


  let decoded = null;
  if (token) {
    try {
      decoded = jwtDecode(token);
    } catch (error) {
      console.error("Invalid token:", error);
    }
  }

  let roleJWT = "";
  if (decoded !== null && decoded !== undefined) {
    if (decoded.roleName !== null && decoded.roleName !== undefined) {
      roleJWT = decoded.roleName;
    }
  }

export const RoleProvider = ({ children }) => {
  const [role, setRole] = useState(""); 

  useEffect(() => {
    // const userLevel = localStorage.getItem(key.USER_LVL);
    const userLevel = roleJWT;
    if (userLevel) {
      setRole(userLevel);
    }
  }, []);

  return (
    <RoleContext.Provider value={{ role }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
