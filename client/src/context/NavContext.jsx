import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { NAV } from "../lib/constants";

const Ctx = createContext(null);
export const useNav = () => useContext(Ctx);

export function NavProvider({ children }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState("none");
  const [sub, setSub] = useState("");
  const [openSec, setOpenSec] = useState(null);
  const [params, setParams] = useState({});  // optional data handed to the next page (e.g. which product to modify)

  // After login, open the first page this person is allowed to see
  useEffect(() => {
    if (!user) return;
    const first = NAV.filter(g => can(g.id))[0];
    if (first) { setPage(first.id); setSub(first.subs[0][0]); setOpenSec(first.id); } else setPage("none");
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((p, s, extra) => {
    if (!can(p)) { const g = NAV.find(n => n.id === p); return toast(`You don't have access to ${g ? g.label : "that page"}`); }
    setParams(extra || {}); setPage(p); setSub(s || NAV.find(n => n.id === p).subs[0][0]); setOpenSec(p);
    window.scrollTo(0, 0);
  }, [can, toast]);

  const toggleGroup = useCallback(id => {
    if (openSec === id) { setOpenSec(null); return; }
    setOpenSec(id);
    if (page !== id) go(id);
  }, [openSec, page, go]);

  return <Ctx.Provider value={{ page, sub, openSec, params, go, toggleGroup }}>{children}</Ctx.Provider>;
}
