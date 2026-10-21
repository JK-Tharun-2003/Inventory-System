import { useEffect, useState } from "react";
import AlertBanner from "../components/AlertBanner";
import {
  CardTitle,
  Loading,
  PageHeader,
  formEnter,
  useAct,
  useFetch,
} from "../components/ui";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useEntry } from "../context/EntryContext";
import { useNav } from "../context/NavContext";
import { useToast } from "../context/ToastContext";
import { money, dateOf } from "../lib/format";

export function WarehousePage() {
  const { products, warehouses, stockOf, low, alert, alertCount } = useData();
  const [tab, setTab] = useState("");
  const whTab = warehouses.includes(tab) ? tab : warehouses[0];
  const cards = warehouses.map((w) => {
    const units = products.reduce((s, p) => s + stockOf(w, p.barcode), 0),
      val = products.reduce((s, p) => s + stockOf(w, p.barcode) * p.buy, 0);
    return (
      <div key={w} className={`kpi ${w === whTab ? "a" : ""}`}>
        <div className="k">
          {w}
          {alertCount[w] ? (
            <span className="cnt inline" title={`${alertCount[w]} alerts`}>
              {alertCount[w]}
            </span>
          ) : null}
        </div>
        <div className="v">{units} units</div>
        <div className="sm">Stock value {money(val)}</div>
      </div>
    );
  });
  return (
    <>
      <PageHeader
        title="Warehouse"
        desc="Stock in each location (updates when you save purchases and sales)"
      />
      <AlertBanner scope="warehouse" />
      <div className="whgrid">{cards}</div>
      <section className="card">
        <div className="tabs">
          {warehouses.map((w) => (
            <button
              key={w}
              className={`tab ${w === whTab ? "on" : ""}`}
              onClick={() => setTab(w)}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th className="r">Quantity</th>
                <th className="r">Stock value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const q = stockOf(whTab, p.barcode);
                return (
                  <tr key={p.barcode}>
                    <td>
                      <b>{p.name}</b>
                    </td>
                    <td>
                      <span className="tag">{p.barcode}</span>
                    </td>
                    <td className="r">
                      <b>{q}</b> {p.unit}
                    </td>
                    <td className="r">{money(q * p.buy)}</td>
                    <td>
                      {q < alert ? (
                        <span className="low-badge">
                          {q <= 0 ? "Out of stock" : `⚠ Alert · under ${alert}`}
                        </span>
                      ) : q < low ? (
                        <span className="tag u">Low stock</span>
                      ) : (
                        <span className="ok-badge">In stock</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function LowStockPage() {
  const { lowItems, low } = useData();
  const { can } = useAuth();
  const { P } = useEntry();
  const { go } = useNav();
  const toast = useToast();
  const items = lowItems();
  const restock = (l) => {
    P.setCart((c) =>
      c.find((i) => i.bc === l.p.barcode)
        ? c
        : [...c, { bc: l.p.barcode, qty: 50, buy: l.p.buy, mrp: l.p.mrp }],
    );
    P.setMeta((x) => ({ ...x, wh: l.w }));
    go("purchase", "new");
    toast(`${l.p.name} added to a new purchase (50 ${l.p.unit})`);
  };
  return (
    <>
      <PageHeader
        title="Low stock"
        desc={`Items under ${low} units, restock them in one click`}
      />
      {items.length ? (
        <section className="card">
          <CardTitle icon="warehouse">
            {items.length} item{items.length === 1 ? "" : "s"} need attention
          </CardTitle>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th className="r">Left</th>
                  <th className="r">Reorder cost (50 units)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.w + l.p.barcode}>
                    <td>
                      <b>{l.p.name}</b>{" "}
                      <span className="tag">{l.p.barcode}</span>
                    </td>
                    <td>{l.w}</td>
                    <td className="r">
                      <span className="low-badge">
                        {l.q} {l.p.unit}
                      </span>
                    </td>
                    <td className="r">{money(l.p.buy * 50)}</td>
                    <td className="r">
                      {can("purchase") && (
                        <button
                          className="btn sm green"
                          onClick={() => restock(l)}
                        >
                          Restock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="empty" style={{ border: 0 }}>
            Everything is well stocked. 🎉
          </div>
        </section>
      )}
    </>
  );
}

export function TransferPage() {
  const { warehouses, products, stockOf, refresh } = useData();
  const act = useAct();
  const { data, loading, reload } = useFetch("/transfers");
  const [f, setF] = useState({ from: "", to: "", bc: "", qty: 10 });
  useEffect(() => {
    setF((x) => ({
      ...x,
      from: x.from || warehouses[0] || "",
      to: x.to || warehouses[1] || warehouses[0] || "",
      bc: x.bc || products[0]?.barcode || "",
    }));
  }, [warehouses, products]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const p = products.find((x) => x.barcode === f.bc);

  const submit = async () => {
    const qty = parseFloat(f.qty);
    if (f.from === f.to)
      return act(async () => {
        throw new Error("Choose two different warehouses");
      });
    if (!(qty > 0))
      return act(async () => {
        throw new Error("Enter a quantity");
      });
    await act(
      async () => {
        const r = await api("/transfers", {
          method: "POST",
          body: { from: f.from, to: f.to, barcode: f.bc, qty },
        });
        await refresh();
        reload();
        return r;
      },
      () => `Moved ${qty} ${p.unit} of ${p.name} to ${f.to}`,
    );
  };
  return (
    <div onKeyDown={formEnter}>
      <PageHeader
        title="Stock transfer"
        desc="Move stock from one warehouse to another"
      />
      <div className="bottom">
        <section className="card">
          <CardTitle icon="warehouse">New transfer</CardTitle>
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div className="field">
                <label className="l" htmlFor="tf-from">
                  From
                </label>
                <select id="tf-from" value={f.from} onChange={set("from")}>
                  {warehouses.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="l" htmlFor="tf-to">
                  To
                </label>
                <select id="tf-to" value={f.to} onChange={set("to")}>
                  {warehouses.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="l" htmlFor="tf-prod">
                Product
              </label>
              <select id="tf-prod" value={f.bc} onChange={set("bc")}>
                {products.map((x) => (
                  <option key={x.barcode} value={x.barcode}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="l" htmlFor="tf-qty">
                Quantity
              </label>
              <input
                id="tf-qty"
                type="number"
                min="1"
                value={f.qty}
                onChange={set("qty")}
              />
              <span className="sm">
                {p
                  ? `Available in ${f.from}: ${stockOf(f.from, p.barcode)} ${p.unit}`
                  : ""}
              </span>
            </div>
            <button className="btn primary" onClick={submit}>
              Transfer stock
            </button>
          </div>
        </section>
        <section className="card">
          <CardTitle icon="doc">Recent transfers</CardTitle>
          {loading ? (
            <Loading />
          ) : data && data.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Route</th>
                  <th className="r">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t, i) => (
                  <tr key={i}>
                    <td>{dateOf(t.ts)}</td>
                    <td>
                      <b>{t.name}</b>
                    </td>
                    <td>
                      {t.from} → {t.to}
                    </td>
                    <td className="r">
                      <b>{t.qty}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No transfers yet</div>
          )}
        </section>
      </div>
    </div>
  );
}
