import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useData } from "./DataContext";

const Ctx = createContext(null);
export const useEntry = () => useContext(Ctx);

// The sales / purchase bills being typed live here, so they survive moving between pages
// (e.g. "Restock" on Low stock drops items into the purchase bill).
export function EntryProvider({ children }) {
  const { warehouses } = useData();
  const [cartP, setCartP] = useState([]);
  const [cartS, setCartS] = useState([]);
  const [lastS, setLastS] = useState(null);
  const [metaP, setMetaP] = useState({ vendor: "", bill: "", wh: "", status: "Paid", method: "Cash" });
  const [metaS, setMetaS] = useState({ customer: "Walk-in customer", wh: "", status: "Paid", method: "Cash", cash: "" });

  // default warehouse = first one
  useEffect(() => {
    if (!warehouses.length) return;
    const fix = m => (warehouses.includes(m.wh) ? m : { ...m, wh: warehouses[0] });
    setMetaP(fix); setMetaS(fix);
  }, [warehouses]);

  const value = useMemo(() => ({
    P: { cart: cartP, setCart: setCartP, meta: metaP, setMeta: setMetaP },
    S: { cart: cartS, setCart: setCartS, meta: metaS, setMeta: setMetaS },
    lastS, setLastS
  }), [cartP, cartS, metaP, metaS, lastS]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
