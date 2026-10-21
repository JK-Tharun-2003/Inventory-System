import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { CardTitle, Loading, PageHeader, formEnter, useAct, useFetch } from "../components/ui";
import { api } from "../api";
import { useData } from "../context/DataContext";
import { useNav } from "../context/NavContext";
import { useToast } from "../context/ToastContext";
import { ROLE_PRESETS, SECTION_LABELS } from "../lib/constants";

export function StaffPage() {
  const { data, loading, error, reload } = useFetch("/staff");
  const { go } = useNav();
  const toast = useToast();
  const act = useAct();
  const [list, setList] = useState([]);
  useEffect(() => { if (data) setList(data); }, [data]);
  if (loading && !data) return <Loading />;
  if (error) return <div className="empty">{error}</div>;

  const patch = (id, body, msg) => act(async () => api(`/staff/${id}`, { method: "PATCH", body }), msg);
  const toggle = (s, k, on) => {   // switch flips immediately, then saves
    setList(l => l.map(x => (x.id === s.id ? { ...x, perms: { ...x.perms, [k]: on } } : x)));
    patch(s.id, { perms: { [k]: on } }).then(ok => { if (!ok) reload(); });
  };
  const setRole = (s, role) => { setList(l => l.map(x => (x.id === s.id ? { ...x, role } : x))); patch(s.id, { role }).then(ok => { if (!ok) reload(); }); };
  const setPin = (s, el) => {
    const v = el.value.trim(); if (!v) return;
    if (v.length < 3) { toast("PIN must be at least 3 characters"); el.value = ""; return; }
    patch(s.id, { pin: v }, "PIN updated").then(() => { el.value = ""; });
  };
  const remove = s => act(async () => { await api(`/staff/${s.id}`, { method: "DELETE" }); reload(); });

  return (<div onKeyDown={formEnter}>
    <PageHeader title="Team & permissions" desc="Switch on only the pages each staff member may open"
      right={<button className="btn green" onClick={() => go("staff", "add")}>+ Add staff</button>} />
    <section className="card"><CardTitle icon="staff">Team ({list.length})</CardTitle>
      <div className="staffhead"><div>Name</div><div>Role</div><div>PIN</div><div>Page access</div><div style={{ width: 36 }}></div></div>
      {list.length ? list.map(s => (
        <div className="staffrow" key={s.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div className="avatar">{s.name[0] || "?"}</div><div><b>{s.name}</b></div></div>
          <select value={s.role} aria-label={`Role for ${s.name}`} onChange={e => setRole(s, e.target.value)}>{Object.keys(ROLE_PRESETS).map(r => <option key={r}>{r}</option>)}</select>
          <input className="mini" data-pin={s.id} type="password" placeholder="New PIN" maxLength={8} autoComplete="new-password" aria-label={`New PIN for ${s.name}`} style={{ width: 100 }} onBlur={e => setPin(s, e.target)} />
          <div className="perms">{Object.keys(SECTION_LABELS).map(k => (
            <label className="perm" key={k}><span className="sw"><input type="checkbox" checked={!!s.perms[k]} onChange={e => toggle(s, k, e.target.checked)} /><i></i></span>{SECTION_LABELS[k]}</label>))}</div>
          <button className="x" aria-label={`Remove ${s.name}`} onClick={() => remove(s)}><Icon name="x" /></button>
        </div>)) : <div className="empty">No staff yet. Add your first staff member.</div>}
      <div className="sub" style={{ marginTop: 14 }}>Staff can never open <b>Staff access</b>. Only the admin can manage staff, delete products and groups. PINs are stored securely, so type a new PIN to change one.</div>
    </section></div>);
}

export function StaffAddPage() {
  const { go } = useNav();
  const act = useAct();
  const [f, setF] = useState({ name: "", role: "Cashier", pin: "1234" });
  const presetPerms = r => Object.fromEntries(Object.keys(SECTION_LABELS).map(k => [k, !!ROLE_PRESETS[r][k]]));
  const [perms, setPerms] = useState(presetPerms("Cashier"));
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));

  async function save() {
    const name = f.name.trim(), pin = f.pin.trim();
    if (!name) return act(async () => { throw new Error("Enter a name"); });
    if (pin.length < 3) return act(async () => { throw new Error("PIN must be at least 3 characters"); });
    const ok = await act(async () => api("/staff", { method: "POST", body: { name, role: f.role, pin, perms } }), `${name} added`);
    if (ok) go("staff", "team");
  }
  return (<div onKeyDown={formEnter}>
    <PageHeader title="Add staff" desc="Create a staff login and choose what they can open" />
    <section className="card"><CardTitle icon="staff">Staff details</CardTitle>
      <div className="formgrid">
        <div className="field"><label className="l" htmlFor="ns-name">Full name</label><input id="ns-name" placeholder="e.g. Suresh Fernando" value={f.name} onChange={set("name")} /></div>
        <div className="field"><label className="l" htmlFor="ns-role">Role</label>
          <select id="ns-role" value={f.role} onChange={e => { setF(x => ({ ...x, role: e.target.value })); setPerms(presetPerms(e.target.value)); }}>
            {Object.keys(ROLE_PRESETS).map(r => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label className="l" htmlFor="ns-pin">Login PIN</label><input id="ns-pin" value={f.pin} maxLength={8} onChange={set("pin")} /></div>
      </div>
      <div className="lbl" style={{ margin: "18px 0 10px" }}>Pages this person can open</div>
      <div className="perms">{Object.keys(SECTION_LABELS).map(k => (
        <label className="perm" key={k}><span className="sw"><input type="checkbox" checked={!!perms[k]} onChange={e => setPerms(p => ({ ...p, [k]: e.target.checked }))} /><i></i></span>{SECTION_LABELS[k]}</label>))}</div>
      <div className="sub" style={{ marginTop: 8 }}>Choosing a role fills in a sensible default. You can change the switches.</div>
      <div className="actions" style={{ marginTop: 20, maxWidth: 360 }}>
        <button className="btn" onClick={() => go("staff", "team")}>Cancel</button>
        <button className="btn primary" onClick={save}>Add staff</button></div>
    </section></div>);
}

export function AdminSettingsPage() {
  const { shop, refresh } = useData();
  const act = useAct();
  const [pw, setPw] = useState({ old: "", n: "", n2: "" });
  const [sh, setSh] = useState({ name: shop.name, line: shop.line });
  useEffect(() => setSh({ name: shop.name, line: shop.line }), [shop.name, shop.line]);
  const setP = k => e => setPw(x => ({ ...x, [k]: e.target.value }));

  async function savePass() {
    if (pw.n.length < 4) return act(async () => { throw new Error("New password must be at least 4 characters"); });
    if (pw.n !== pw.n2) return act(async () => { throw new Error("New passwords do not match"); });
    const ok = await act(async () => api("/settings/password", { method: "PUT", body: { current: pw.old, next: pw.n } }), "Admin password changed");
    if (ok) setPw({ old: "", n: "", n2: "" });
  }
  const saveShop = () => act(async () => { await api("/settings/shop", { method: "PUT", body: sh }); await refresh(); }, "Shop details saved");

  return (<div onKeyDown={formEnter}>
    <PageHeader title="Admin settings" desc="Your login and the details printed on bills" />
    <div className="bottom">
      <section className="card"><CardTitle icon="staff">Change admin password</CardTitle>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="field"><label className="l" htmlFor="pw-old">Current password</label><input id="pw-old" type="password" autoComplete="off" value={pw.old} onChange={setP("old")} /></div>
          <div className="field"><label className="l" htmlFor="pw-new">New password</label><input id="pw-new" type="password" autoComplete="off" value={pw.n} onChange={setP("n")} /></div>
          <div className="field"><label className="l" htmlFor="pw-new2">Confirm new password</label><input id="pw-new2" type="password" autoComplete="off" value={pw.n2} onChange={setP("n2")} /></div>
          <button className="btn primary"  onClick={savePass}>Save password</button>
        </div></section>
      <section className="card"><CardTitle icon="print">Shop details on bills</CardTitle>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="field"><label className="l" htmlFor="shop-name">Shop name</label><input id="shop-name" value={sh.name} onChange={e => setSh(x => ({ ...x, name: e.target.value }))} /></div>
          <div className="field"><label className="l" htmlFor="shop-line">Address / phone line</label><input id="shop-line" value={sh.line} onChange={e => setSh(x => ({ ...x, line: e.target.value }))} /></div>
          <button className="btn primary"  onClick={saveShop}>Save shop details</button>
        </div></section>
    </div></div>);
}
