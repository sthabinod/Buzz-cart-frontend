import React, { createContext, useContext, useEffect, useState } from "react";
import { login as doLogin, logout as doLogout } from "../services/authService";
import { tokenStore } from "../apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username, tenant_id, claims }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const access = tokenStore.access;
    if (access) {
      try {
        const [, payload] = access.split(".");
        const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        setUser({ username: claims?.username, tenant_id: claims?.tenant_id, claims });
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, []);

  const login = async (creds) => {
    const { claims } = await doLogin(creds);
    setUser({ username: claims?.username, tenant_id: claims?.tenant_id, claims });
  };

  const logout = () => {
    doLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
