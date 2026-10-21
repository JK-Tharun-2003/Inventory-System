import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import AlertBanner from "../components/AlertBanner";
import { CardTitle, Gchip, PageHeader, formEnter, focusSel, useAct } from "../components/ui";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNav } from "../context/NavContext";
import { UNITS, SUGGESTED_GROUPS } from "../lib/constants";
import { money, margin } from "../lib/format";

export function ProductsPage() {
  const { products, groups, warehouses, stockOf, refresh, alert, alertCount } = useData();
  const { isAdmin } = useAuth();
  const { go } = useNav();
  const act = useAct();
  const [pfilter, setPfilter] = useState("");
  const [gfilter, setGfilter] = useState("");
  const g = gfilter && groups.includes(gfilter) ? gfilter : "";
  const q = pfilter.toLowerCase();
  const list = products.filter(p => (!g || p.group === g) && (p.name.toLowerCase().includes(q) || p.barcode.includes(q)));

  const patch = (bc, body, msg) => act(async () => { await api(`/products/${bc}`, { method: "PATCH", body }); await refresh(); }, msg);
  const del = bc => act(async () => { await api(`/products/${bc}`, { method: "DELETE" }); await refresh(); }, "Product deleted");

  return (<>
    <PageHeader title="All products" desc="Everything you buy and sell" right={
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => go("products", "groups")}>Manage groups</button>
        <button className="btn green" onClick={() => go("products", "add")}>+ Add product</button></div>} />
    <AlertBanner scope="products" />
    <section className="card"><CardTitle icon="products">Product list</CardTitle>
      <div className="tabs">
        <button className={`tab ${g === "" ? "on" : ""}`} onClick={() => setGfilter("")}>All ({products.length})</button>
        {groups.map(x => <button key={x} className={`tab ${g === x ? "on" : ""}`} onClick={() => setGfilter(x)}>{x} ({products.filter(p => p.group === x).length})</button>)}
      </div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 12 }}>
        <input placeholder="Search by name or barcode" value={pfilter} onChange={e => setPfilter(e.target.value)} aria-label="Search products" /></div>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Product</th><th>Barcode</th><th>Group</th><th>Unit</th><th className="r">Purchase price</th><th className="r">Selling price</th><th>Margin</th><th className="r">Total stock</th><th>Alert</th><th></th></tr></thead>
        <tbody>{list.length ? list.map(p => {
          const tot = warehouses.reduce((s, w) => s + stockOf(w, p.barcode), 0), mg = margin({ buy: p.buy, mrp: p.mrp });
          const units = UNITS.includes(p.unit) ? UNITS : [...UNITS, p.unit];
          return (
            <tr key={p.barcode}>
              <td><b>{p.name}</b></td><td><span className="tag">{p.barcode}</span></td>
              <td><select className="mini" value={p.group} aria-label={`Group for ${p.name}`} onChange={e => patch(p.barcode, { group: e.target.value })}>{groups.map(x => <option key={x}>{x}</option>)}</select></td>
              <td><select className="mini" style={{ minWidth: 78 }} value={p.unit} aria-label={`Unit for ${p.name}`} onChange={e => patch(p.barcode, { unit: e.target.value }, `Unit changed to ${e.target.value}`)}>{units.map(u => <option key={u}>{u}</option>)}</select></td>
              <td className="r">{money(p.buy)}</td><td className="r">{money(p.mrp)}</td>
              <td><span className={`pill ${mg < 5 ? "low" : ""}`}>{mg.toFixed(1)}%</span></td>
              <td className="r"><b>{tot}</b> {p.unit}</td>
              <td>{alertCount[p.barcode] ? <button className="low-badge alertpill" title={`Under ${alert} units in ${alertCount[p.barcode]} warehouse(s)`} onClick={() => go("notifications", "all")}>⚠ Low in {alertCount[p.barcode]}</button> : <span className="ok-badge">OK</span>}</td>
              <td className="r actions-cell"><button className="btn sm" aria-label={`Edit ${p.name}`} onClick={() => go("products", "modify", { barcode: p.barcode })}><Icon name="edit" /> Edit</button>{" "}{isAdmin && <button className="x" aria-label={`Delete ${p.name}`} style={{ marginLeft: "auto" }} onClick={() => del(p.barcode)}><Icon name="x" /></button>}</td>
            </tr>);
        }) : <tr><td colSpan="10" style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No products found</td></tr>}</tbody>
      </table></div></section>
  </>);
}

export function ProductAddPage() {
  const { groups, refresh } = useData();
  const { go } = useNav();
  const act = useAct();
  const [f, setF] = useState({ barcode: "", name: "", group: groups[0] || "", unit: "kg", buy: "", mrp: "" });
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  async function save() {
    const buy = parseFloat(f.buy), mrp = parseFloat(f.mrp);
    if (!f.barcode.trim() || !f.name.trim() || isNaN(buy) || isNaN(mrp)) return act(async () => { throw new Error("Fill barcode, name and both prices"); });
    const ok = await act(async () => { await api("/products", { method: "POST", body: { ...f, buy, mrp } }); await refresh(); }, `${f.name.trim()} added to ${f.group}`);
    if (ok) go("products", "all");
  }
  return (<div onKeyDown={formEnter}>
    <PageHeader title="Add product" desc="Create a new item for your catalogue" />
    <section className="card narrow"><CardTitle icon="products">Product details</CardTitle>
      <div className="formgrid">
        <div className="field"><label className="l" htmlFor="np-bc">Barcode</label><input id="np-bc" placeholder="e.g. 8901234500005" value={f.barcode} onChange={set("barcode")} /></div>
        <div className="field"><label className="l" htmlFor="np-name">Product name</label><input id="np-name" placeholder="e.g. Red onion" value={f.name} onChange={set("name")} /></div>
        <div className="field"><label className="l" htmlFor="np-group">Group</label><select id="np-group" value={f.group} onChange={set("group")}>{groups.map(g => <option key={g}>{g}</option>)}</select></div>
        <div className="field"><label className="l" htmlFor="np-unit">Unit</label><select id="np-unit" value={f.unit} onChange={set("unit")}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
        <div className="field"><label className="l" htmlFor="np-buy">Purchase price (Rs.)</label><input id="np-buy" type="number" min="0" step="0.01" value={f.buy} onChange={set("buy")} /></div>
        <div className="field"><label className="l" htmlFor="np-mrp">Selling price (Rs.)</label><input id="np-mrp" type="number" min="0" step="0.01" value={f.mrp} onChange={set("mrp")} /></div>
      </div>
      <div className="actions formactions">
        <button className="btn" onClick={() => go("products", "all")}>Cancel</button>
        <button className="btn primary" onClick={save}>Save product</button></div>
      <div className="flowhint">Need to change a product you already added? <button type="button" className="textlink" onClick={() => go("products", "modify")}>Modify product</button></div>
    </section></div>);
}

// Modify an existing product: pick it from the list on the left, change anything except the barcode
export function ProductModifyPage() {
  const { products, groups, warehouses, stockOf, refresh } = useData();
  const { isAdmin } = useAuth();
  const { go, params } = useNav();
  const act = useAct();
  const [q, setQ] = useState("");
  const [bc, setBc] = useState(params.barcode || "");
  const p = products.find(x => x.barcode === bc);
  const blank = { name: "", group: "", unit: "kg", buy: "", mrp: "" };
  const [f, setF] = useState(blank);
  useEffect(() => { setF(p ? { name: p.name, group: p.group, unit: p.unit, buy: String(p.buy), mrp: String(p.mrp) } : blank); }, [p?.barcode]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const list = products.filter(x => x.name.toLowerCase().includes(q.toLowerCase()) || x.barcode.includes(q));
  const buy = parseFloat(f.buy), mrp = parseFloat(f.mrp);
  const mg = mrp > 0 ? ((mrp - buy) / mrp) * 100 : 0;
  const changed = p && (f.name.trim() !== p.name || f.group !== p.group || f.unit !== p.unit || buy !== p.buy || mrp !== p.mrp);
  const units = UNITS.includes(f.unit) || !f.unit ? UNITS : [...UNITS, f.unit];

  async function save() {
    if (!f.name.trim() || isNaN(buy) || isNaN(mrp) || buy < 0 || mrp < 0) return act(async () => { throw new Error("Fill the name and both prices"); });
    await act(async () => { await api(`/products/${p.barcode}`, { method: "PATCH", body: { name: f.name.trim(), group: f.group, unit: f.unit, buy, mrp } }); await refresh(); }, `${f.name.trim()} updated`);
  }
  const del = async () => {
    const ok = await act(async () => { await api(`/products/${p.barcode}`, { method: "DELETE" }); await refresh(); }, "Product deleted");
    if (ok) setBc("");
  };

  return (<div onKeyDown={formEnter}>
    <PageHeader title="Modify product" desc="Change the name, group, unit or prices of a product you already added" />
    <div className="split">
      <section className="card"><CardTitle icon="products">Choose a product</CardTitle>
        <div className="field" style={{ marginBottom: 12 }}><input placeholder="Search by name or barcode" aria-label="Search products to modify" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="picklist" role="listbox" aria-label="Products">
          {list.length ? list.map(x => (
            <button key={x.barcode} type="button" role="option" aria-selected={x.barcode === bc} className={`pick ${x.barcode === bc ? "on" : ""}`} onClick={() => setBc(x.barcode)}>
              <b>{x.name}</b><span className="tag">{x.barcode}</span></button>
          )) : <div className="empty">No products found</div>}
        </div></section>

      <section className="card"><CardTitle icon="edit">{p ? `Editing: ${p.name}` : "Product details"}</CardTitle>
        {!p ? <div className="empty">Select a product on the left to modify it.</div> : (<>
          <div className="formgrid">
            <div className="field"><label className="l" htmlFor="mp-bc">Barcode (cannot be changed)</label><input id="mp-bc" value={p.barcode} readOnly /></div>
            <div className="field"><label className="l" htmlFor="mp-name">Product name</label><input id="mp-name" value={f.name} onChange={set("name")} /></div>
            <div className="field"><label className="l" htmlFor="mp-group">Group</label><select id="mp-group" value={f.group} onChange={set("group")}>{groups.map(g => <option key={g}>{g}</option>)}</select></div>
            <div className="field"><label className="l" htmlFor="mp-unit">Unit</label><select id="mp-unit" value={f.unit} onChange={set("unit")}>{units.map(u => <option key={u}>{u}</option>)}</select></div>
            <div className="field"><label className="l" htmlFor="mp-buy">Purchase price (Rs.)</label><input id="mp-buy" type="number" min="0" step="0.01" value={f.buy} onChange={set("buy")} /></div>
            <div className="field"><label className="l" htmlFor="mp-mrp">Selling price (Rs.)</label><input id="mp-mrp" type="number" min="0" step="0.01" value={f.mrp} onChange={set("mrp")} /></div>
          </div>
          <div className="mgrow"><span>Margin</span><span className={`pill ${mg < 5 ? "low" : ""}`}>{isNaN(mg) ? "–" : mg.toFixed(1)}%</span>
            <span className="sub" style={{ margin: 0 }}>Stock now: {warehouses.map(w => `${w} ${stockOf(w, p.barcode)}`).join(" · ")} {p.unit}</span></div>
          <div className="actions formactions">
            <button className="btn" disabled={!changed} onClick={() => setF({ name: p.name, group: p.group, unit: p.unit, buy: String(p.buy), mrp: String(p.mrp) })}>Undo changes</button>
            <button className="btn primary" disabled={!changed} onClick={save}>Save changes</button>
            {isAdmin && <button className="btn danger" onClick={del}>Delete</button>}
          </div>
          <div className="flowhint">Changing a price does not alter bills that were already saved.</div>
        </>)}
      </section>
    </div>
  </div>);
}

export function GroupsPage() {
  const { groups, products, warehouses, stockOf, refresh } = useData();
  const { isAdmin } = useAuth();
  const act = useAct();
  const [name, setName] = useState("");
  const sugg = SUGGESTED_GROUPS.filter(x => !groups.some(g => g.toLowerCase() === x.toLowerCase()));

  const add = async n => {
    const v = (n ?? name).trim();
    if (!v) return act(async () => { throw new Error("Type a group name"); });
    const ok = await act(async () => { await api("/groups", { method: "POST", body: { name: v } }); await refresh(); }, `Group "${v}" added`);
    if (ok) { setName(""); focusSel(document.getElementById("g-name")); }
  };
  const rename = (old, val) => {
    const n = val.trim(); if (n === old) return;
    act(async () => { await api(`/groups/${encodeURIComponent(old)}`, { method: "PATCH", body: { name: n } }); await refresh(); }, `Renamed to "${n}"`)
      .then(ok => { if (!ok) refresh(); });
  };
  const del = g => act(async () => { await api(`/groups/${encodeURIComponent(g)}`, { method: "DELETE" }); await refresh(); }, "Group deleted");

  return (<div onKeyDown={formEnter}>
    <PageHeader title="Product groups" desc="Organise products into categories like Grocery, Stationery, Beverages" />
    <section className="card"><CardTitle icon="products">Add a group</CardTitle>
      <div style={{ display: "flex", gap: 10, maxWidth: 520 }}>
        <input id="g-name" placeholder="e.g. Bakery" aria-label="Group name" style={{ flex: 1 }} value={name} onChange={e => setName(e.target.value)} />
        <button className="btn primary"  onClick={() => add()}>+ Add group</button></div>
      {sugg.length > 0 && <><div className="lbl" style={{ margin: "16px 0 8px" }}>Quick add</div>
        <div className="quick">{sugg.map(x => <button key={x} type="button" className="chipbtn" onClick={() => add(x)}>+ {x}</button>)}</div></>}
    </section>
    <section className="card"><CardTitle icon="doc">{groups.length} group{groups.length === 1 ? "" : "s"}</CardTitle>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Group</th><th>Rename</th><th className="r">Products</th><th className="r">Stock value (cost)</th><th></th></tr></thead>
        <tbody>{groups.map(g => {
          const ps = products.filter(p => p.group === g), val = ps.reduce((a, p) => a + warehouses.reduce((t, w) => t + stockOf(w, p.barcode), 0) * p.buy, 0);
          return (
            <tr key={g}><td><Gchip name={g} /></td>
              <td><input key={g} className="mini gname" data-gname={g} defaultValue={g} aria-label={`Rename group ${g}`} onBlur={e => rename(g, e.target.value)} /></td>
              <td className="r"><b>{ps.length}</b></td><td className="r">{money(val)}</td>
              <td className="r">{isAdmin && <button className="x" aria-label={`Delete group ${g}`} style={{ marginLeft: "auto" }} onClick={() => del(g)}><Icon name="x" /></button>}</td></tr>);
        })}</tbody></table></div></section>
  </div>);
}
