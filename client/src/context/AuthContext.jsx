import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "../api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null); });
    if (!getToken()) return;
    api("/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setBooting(false));
  }, []);

  const login = useCallback(async body => {
    const r = await api("/auth/login", { method: "POST", body });
    setToken(r.token); setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  const value = useMemo(() => {
    const isAdmin = !!user && user.type === "admin";
    // Admin opens everything; staff never open "staff"; other pages need their switch on
    const can = sec => { if (!user) return false; if (isAdmin) return true; if (sec === "staff") return false;
      // Stock alerts are visible to anyone who can open Products or Warehouse
      if (sec === "notifications") return !!(user.perms && (user.perms.products || user.perms.warehouse));
      return !!(user.perms && user.perms[sec]); };
    return { user, booting, login, logout, isAdmin, can };
  }, [user, booting, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
