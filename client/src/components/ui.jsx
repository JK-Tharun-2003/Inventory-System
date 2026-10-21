import { useToast as useToastHook } from "../context/ToastContext";
import { api } from "../api";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { NAV, GCOL } from "../lib/constants";
import { useNav } from "../context/NavContext";
import { useData } from "../context/DataContext";

export function Crumb() {
  const { page, sub } = useNav();
  const g = NAV.find(n => n.id === page); if (!g) return null;
  const t = g.subs.find(x => x[0] === sub);
  return <div className="crumb">{g.label} › <b>{t ? t[1] : ""}</b></div>;
}

export const PageHeader = ({ title, desc, right }) => (
  <header className="pagehead">
    <div className="ph-text"><Crumb /><h1>{title}</h1>{desc ? <div className="sub">{desc}</div> : null}</div>
    {right ? <div className="ph-right">{right}</div> : null}
  </header>
);

export const CardTitle = ({ icon, children, extra }) => (
  <h2><span className="ic"><Icon name={icon} /></span>{children}{extra ? <><span className="grow" />{extra}</> : null}</h2>
);

export const KpiRow = ({ items }) => (
  <div className="kpis">
    {items.map(([k, v, c]) => <div key={k} className={`kpi ${c}`}><div className="k">{k}</div><div className="v">{v}</div></div>)}
  </div>
);

export const StatusBadge = ({ status }) => (status === "Paid" ? <span className="ok-badge">Paid</span> : <span className="tag u">{status}</span>);

export function Gchip({ name }) {
  const { groups } = useData();
  const c = GCOL[Math.max(0, groups.indexOf(name)) % GCOL.length];
  return <span className="gchip" style={{ background: c[0], color: c[1] }}>{name}</span>;
}

// Number box that lets you clear and retype freely (the value is stored as a number)
export function NumInput({ value, onChange, ...rest }) {
  const [txt, setTxt] = useState(String(value));
  const ref = useRef(value);
  useEffect(() => {
    if ((parseFloat(txt) || 0) !== value) setTxt(String(value));
    ref.current = value;
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input type="number" {...rest} value={txt} onChange={e => { setTxt(e.target.value); onChange(parseFloat(e.target.value) || 0); }} />;
}

export function Loading({ text = "Loading…" }) { return <div className="empty" style={{ border: 0 }}>{text}</div>; }

// Fetch a list from the API when the page opens
export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState(s => ({ ...s, loading: true }));
    api(path)
      .then(data => live && setState({ data, error: "", loading: false }))
      .catch(e => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [path, tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: () => setTick(t => t + 1) };
}

export const focusSel = el => { if (!el) return; el.focus(); try { if (el.select && el.type !== "radio") el.select(); } catch { /* ignore */ } };

// Run an API call, show a toast on success / failure
export function useAct() {
  const toast = useToastHook();
  return async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); return r ?? true; }
    catch (e) { toast(e.message); return false; }
  };
}

// Enter = next field on the simple form pages; on the last field it presses the main button
export function formEnter(e) {
  if (e.key !== "Enter") return;
  const t = e.target;
  if (t.dataset && (t.dataset.pin !== undefined || t.dataset.gname !== undefined)) { e.preventDefault(); t.blur(); return; }
  if (!t.matches("input,select") || t.type === "checkbox") return;
  e.preventDefault();
  const card = t.closest(".card"); if (!card) return;
  const o = [...card.querySelectorAll("input:not([readonly]):not([type=checkbox]), select")], i = o.indexOf(t);
  if (i < o.length - 1) focusSel(o[i + 1]); else { const pb = card.querySelector(".btn.primary"); if (pb) pb.click(); }
}
