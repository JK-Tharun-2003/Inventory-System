import { useEffect, useState } from "react";
import Icon from "./Icon";
import { NAV } from "../lib/constants";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNav } from "../context/NavContext";

const PREFS_KEY = "stockpilot-sidebar-prefs";
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 360;
const DEFAULT_SIDEBAR_WIDTH = 224;
const COLLAPSED_WIDTH = 76;
const PRESETS = [["Compact", 190], ["Default", DEFAULT_SIDEBAR_WIDTH], ["Wide", 290]];
const THEMES = {
  Forest: ["#12372F", "#0D2B25"], Ocean: ["#17375E", "#0F2744"], Graphite: ["#2B3138", "#1B2025"], Plum: ["#4A2A56", "#341C3D"]
};
const DEFAULTS = { width: DEFAULT_SIDEBAR_WIDTH, collapsed: false, theme: "Forest" };
const clampW = w => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(w)));

function loadPrefs() {
  try {
    const p = JSON.parse(window.localStorage.getItem(PREFS_KEY)) || {};
    return { width: Number.isFinite(p.width) ? clampW(p.width) : DEFAULTS.width, collapsed: !!p.collapsed, theme: THEMES[p.theme] ? p.theme : DEFAULTS.theme };
  } catch { return { ...DEFAULTS }; }
}

export default function Sidebar() {
  const { user, can, isAdmin, logout } = useAuth();
  const { lowItems, unseenCount } = useData();
  const { page, sub, openSec, go, toggleGroup } = useNav();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [panel, setPanel] = useState(false);
  const { width, collapsed, theme } = prefs;
  const allowed = NAV.filter(g => can(g.id));
  const unseen = unseenCount(), lowCount = lowItems().length;
  const patch = o => setPrefs(p => ({ ...p, ...o }));

  useEffect(() => {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  function resizeFromPointer(event) {
    if (event.buttons !== 1) return;
    const sidebarLeft = event.currentTarget.parentElement.getBoundingClientRect().left;
    patch({ width: clampW(event.clientX - sidebarLeft), collapsed: false });
  }

  function resizeFromKeyboard(event) {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    setPrefs(p => ({ ...p, collapsed: false, width: clampW(p.width + direction * 12) }));
  }

  return (
    <nav aria-label="Main menu" className={collapsed ? "collapsed" : ""}
      style={{ "--sidebar-width": `${collapsed ? COLLAPSED_WIDTH : width}px`, "--nav-from": THEMES[theme][0], "--nav-to": THEMES[theme][1] }}>
      <div className="brand"><div className="logo">
        <svg className="i" style={{ stroke: "#12372F", strokeWidth: 2.2 }} viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /></svg></div>StockPilot</div>
      <div className="menu-label">{collapsed ? "" : "Menu"}</div>
      {allowed.map(g => {
        const open = openSec === g.id;
        return (
          <div key={g.id} className={`grp ${open ? "open" : ""}`}>
            <button className={`nav ${page === g.id ? "active" : ""}`} aria-expanded={open} aria-controls={`sub-${g.id}`}
              aria-current={page === g.id ? "page" : undefined} onClick={() => toggleGroup(g.id)}>
              <span className="chip"><Icon name={g.id} />{g.id === "notifications" && unseen > 0 && <span className="dot" aria-hidden="true" />}</span><span className="t">{g.label}</span>{g.id === "notifications" && unseen > 0 && <span className="cnt" aria-label={`${unseen} unread alerts`}>{unseen}</span>}<Icon name="chev" className="chev" />
            </button>
            <div className="subwrap" id={`sub-${g.id}`}><div className="subinner"><div className="sublist">
              {g.subs.map(([k, l]) => {
                const on = page === g.id && sub === k, showBadge = g.id === "warehouse" && k === "low" && lowCount > 0;
                return (
                  <button key={k} className={`subitem ${on ? "active" : ""}`} aria-current={on ? "page" : undefined} onClick={() => go(g.id, k)}>
                    {l}<span className="cnt" hidden={!showBadge}>{showBadge ? lowCount : ""}</span>
                  </button>
                );
              })}
            </div></div></div>
          </div>
        );
      })}
      <div className="sbtools">
        <button type="button" className="sbtool" aria-expanded={panel} aria-controls="sb-panel" title="Customize menu bar" onClick={() => setPanel(v => !v)}>
          <Icon name="gear" /><span className="t">Customize</span></button>
        <button type="button" className="sbtool" aria-pressed={collapsed} title={collapsed ? "Expand menu bar" : "Collapse menu bar"} onClick={() => patch({ collapsed: !collapsed })}>
          <Icon name="panel" /><span className="t">{collapsed ? "Expand" : "Collapse"}</span></button>
      </div>
      {panel && (
        <div className="sbpanel" id="sb-panel" role="dialog" aria-label="Menu bar settings">
          <div className="sbp-h"><b>Menu bar</b><button type="button" className="sbp-x" aria-label="Close" onClick={() => setPanel(false)}>×</button></div>
          <div className="sbp-l">Width <em>{collapsed ? "icons only" : `${width}px`}</em></div>
          <div className="sbp-presets">{PRESETS.map(([n, w]) => <button key={n} type="button" className={!collapsed && width === w ? "on" : ""} onClick={() => patch({ width: w, collapsed: false })}>{n}</button>)}</div>
          <input type="range" aria-label="Menu bar width" min={MIN_SIDEBAR_WIDTH} max={MAX_SIDEBAR_WIDTH} step="4" value={width} onChange={e => patch({ width: clampW(+e.target.value), collapsed: false })} />
          <div className="sbp-l">Colour</div>
          <div className="sbp-themes">{Object.keys(THEMES).map(n => (
            <button key={n} type="button" aria-label={`${n} theme`} aria-pressed={theme === n} title={n} className={theme === n ? "on" : ""} style={{ background: `linear-gradient(160deg,${THEMES[n][0]},${THEMES[n][1]})` }} onClick={() => patch({ theme: n })} />))}</div>
          <button type="button" className="sbp-reset" onClick={() => setPrefs({ ...DEFAULTS })}>Reset to default</button>
        </div>)}
      <div className="who">
        <div className="avatar">{(user.name || "?")[0].toUpperCase()}</div>
        <div className="whoi"><b>{user.name}</b><small>{isAdmin ? "Admin" : user.role || "Staff"}</small></div>
        <button className="logout" title="Log out" aria-label="Log out" onClick={logout}><Icon name="logout" /></button>
      </div>
      <div
        className="sidebar-resize"
        role="separator"
        aria-label="Resize menu bar"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={collapsed ? COLLAPSED_WIDTH : width}
        aria-valuetext={`${collapsed ? COLLAPSED_WIDTH : width} pixels`}
        tabIndex={0}
        onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={resizeFromPointer}
        onKeyDown={resizeFromKeyboard}
        onDoubleClick={() => patch({ width: DEFAULT_SIDEBAR_WIDTH, collapsed: false })}
        title="Drag to resize, double-click to reset"
      />
    </nav>
  );
}
