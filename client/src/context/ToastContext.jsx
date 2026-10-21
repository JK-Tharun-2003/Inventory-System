import { createContext, useCallback, useContext, useRef, useState } from "react";

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState("");
  const timer = useRef();
  const toast = useCallback(m => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2800);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toast" role="status" style={{ display: msg ? "block" : "none" }}>{msg}</div>
    </Ctx.Provider>
  );
}
