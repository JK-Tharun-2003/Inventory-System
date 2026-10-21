import { useEffect, useRef, useState } from "react";
import { focusSel } from "./ui";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("admin");
  const [names, setNames] = useState([]);
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const passRef = useRef(), staffRef = useRef(), pinRef = useRef();

  useEffect(() => {
    api("/auth/staff-names").then(n => { setNames(n); setName(n[0] || ""); }).catch(() => setErr("Cannot reach the server. Is the API running?"));
  }, []);
  useEffect(() => { setErr(""); setPass(""); setPin(""); focusSel(mode === "admin" ? passRef.current : staffRef.current); }, [mode]);

  async function submit() {
    setBusy(true); setErr("");
    try {
      const u = await login(mode === "admin" ? { mode, password: pass } : { mode, name, pin });
      toast(`Welcome, ${u.name}`);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  const onKey = e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.target === staffRef.current) focusSel(pinRef.current); else submit();
  };

  const pwField = (id, ref, label, ph, val, set) => (
    <div className="field"><label htmlFor={id}>{label}</label>
      <div className="lg-pw">
        <input id={id} ref={ref} type={show ? "text" : "password"} autoComplete="off" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
        <button type="button" onClick={() => setShow(s => !s)}>{show ? "Hide" : "Show"}</button>
      </div></div>
  );

  return (
    <div className="login show" onKeyDown={onKey}>
      <aside className="lg-side">
        <div className="lg-logo"><div className="logo"><svg className="i" style={{ stroke: "#12372F", strokeWidth: 2.2 }} viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></svg></div>StockPilot</div>
        <div className="lg-pitch">
          <h2>Sales, purchases and stock in one place</h2>
          <p>Record every sale, track every delivery and always know what is on the shelf, across all your stores and warehouses.</p>
          <ul className="lg-points">
            <li><div className="pi-ic"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg></div><div><b>Fast billing</b><span>Scan a barcode, take payment and print the invoice in seconds.</span></div></li>
            <li><div className="pi-ic"><svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></svg></div><div><b>Live stock levels</b><span>Low-stock alerts and transfers between warehouses.</span></div></li>
            <li><div className="pi-ic"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg></div><div><b>Clear reports</b><span>Daily sales, purchases and stock position at a glance.</span></div></li>
          </ul>
        </div>
        <div className="lg-foot">© {new Date().getFullYear()} StockPilot</div>
      </aside>

      <section className="lg-main">
        <div className="login-card">
          <div className="lg-mbrand"><div className="logo"><svg className="i" style={{ stroke: "#12372F", strokeWidth: 2.2 }} viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></svg></div>StockPilot</div>
          <div className="lg-head"><h1>Sign in</h1><p>Use your admin password or staff PIN to continue.</p></div>
          <div className="lg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "admin"} className={mode === "admin" ? "on" : ""} onClick={() => setMode("admin")}>Admin</button>
            <button type="button" role="tab" aria-selected={mode === "staff"} className={mode === "staff" ? "on" : ""} onClick={() => setMode("staff")}>Staff</button>
          </div>
          <div className="lg-form">
            {mode === "admin" ? (<>
              {pwField("lg-pass", passRef, "Admin password", "Enter password", pass, setPass)}
              <div className="lg-note">Admins can open every page, manage staff access and change the shop details printed on bills.</div>
            </>) : (
              <>
                <div className="field"><label htmlFor="lg-staffsel">Staff name</label>
                  <select id="lg-staffsel" ref={staffRef} value={name} onChange={e => setName(e.target.value)}>
                    {names.length ? names.map(n => <option key={n}>{n}</option>) : <option value="">No staff yet</option>}
                  </select></div>
                {pwField("lg-pin", pinRef, "PIN", "Enter PIN", pin, setPin)}
              </>
            )}
            <div id="lg-err" role="alert">{err}</div>
            <button type="button" className="lg-submit" onClick={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </div>
          <div className="lg-hint">Demo after <b>npm run seed</b>: admin password <b>admin123</b>, staff PIN <b>1234</b></div>
        </div>
      </section>
    </div>
  );
}
