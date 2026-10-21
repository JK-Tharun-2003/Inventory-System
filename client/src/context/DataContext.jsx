import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { LOW, ALERT } from "../lib/constants";

const SEEN_KEY = "stockpilot-alerts-seen";
const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

// Holds the shared catalogue + live stock (the prototype's S object), loaded from the API
export function DataProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  // Which alerts the person has already read: { "Main store|barcode": quantity-when-read }.
  // If the quantity drops further the alert becomes new again.
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* ignore */ } }, [seen]);

  const refresh = useCallback(async () => { const b = await api("/bootstrap"); setD(b); return b; }, []);
  useEffect(() => {
    if (!user) { setD(null); return; }
    refresh().catch(e => toast(e.message));
  }, [user, refresh, toast]);

  const value = useMemo(() => {
    const products = d?.products || [], warehouses = d?.warehouses || [], stock = d?.stock || {}, low = d?.lowStock ?? LOW, alert = d?.alertStock ?? ALERT;
    const prod = bc => products.find(p => p.barcode === bc);
    const stockOf = (wh, bc) => (stock[wh] && stock[wh][bc]) || 0;
    const lowItems = () => {
      const a = [];
      warehouses.forEach(w => products.forEach(p => { const q = stockOf(w, p.barcode); if (q < low) a.push({ w, p, q }); }));
      return a.sort((x, y) => x.q - y.q);
    };
    // Notifications: any product with fewer than `alert` units in a warehouse (0 = out of stock)
    const alertItems = () => {
      const a = [];
      warehouses.forEach(w => products.forEach(p => { const q = stockOf(w, p.barcode); if (q < alert) { const key = `${w}|${p.barcode}`; a.push({ key, w, p, q, out: q <= 0, seen: seen[key] !== undefined && q >= seen[key] }); } }));
      return a.sort((x, y) => x.q - y.q || x.p.name.localeCompare(y.p.name));
    };
    const unseenCount = () => alertItems().filter(a => !a.seen).length;
    const markSeen = items => setSeen(m => { const n = { ...m }; items.forEach(a => { n[a.key] = a.q; }); return n; });
    const alertCount = {}; // alerts per warehouse + per product, handy for badges on the Products / Warehouse pages
    alertItems().forEach(a => { alertCount[a.w] = (alertCount[a.w] || 0) + 1; alertCount[a.p.barcode] = (alertCount[a.p.barcode] || 0) + 1; });
    return {
      ready: !!d, products, groups: d?.groups || [], warehouses, stock, low, alert,
      shop: d?.shop || { name: "Your Shop Name", line: "" }, next: d?.next || { purchase: 1, sale: 1 },
      refresh, prod, stockOf, lowItems, alertItems, unseenCount, markSeen, alertCount
    };
  }, [d, refresh, seen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
