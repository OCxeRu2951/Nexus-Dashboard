import { useState, useEffect, createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";

const AuthContext = createContext(null);

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (PUBLIC_PATHS.includes(location.pathname)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    api
      .get("/user")
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []); // 初回のみ実行

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
