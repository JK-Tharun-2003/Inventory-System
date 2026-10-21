import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import { CardTitle, NumInput, focusSel } from "../components/ui";
import { Crumb } from "../components/ui";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useEntry } from "../context/EntryContext";
import { useToast } from "../context/ToastContext";
import { money, numFmt, dateNow, margin, lineOf } from "../lib/format";
import { printDoc } from "../lib/printDoc";

/* One component drives both "New sale" (kind S) and "New purchase" (kind P), like the prototype */
export default function EntryPage({ kind }) {
  const m = kind,
    P = m === "P";
  const { products, warehouses, prod, stockOf, next, refresh, shop, low } =
    useData();
  const entry = useEntry();
  const { cart, setCart, meta, setMeta } = entry[m];
  const { lastS, setLastS } = entry;
  const toast = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [when, setWhen] = useState(() => dateNow());
  const [saving, setSaving] = useState(false);
  const root = useRef(),
    focusRow = useRef(null),
    saveRef = useRef();

  const units = cart.reduce((s, i) => s + i.qty, 0);
  const net = cart.reduce((s, i) => s + lineOf(m, i), 0);
  const setMetaField = (patch) => setMeta((x) => ({ ...x, ...patch }));
  const patchItem = (i, patch) =>
    setCart((c) => c.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  // cash received (sales only)
  const cashShown = !P && meta.method === "Cash" && meta.status !== "Pending";
  const cashRec =
    !P && meta.cash !== "" && !isNaN(parseFloat(meta.cash))
      ? parseFloat(meta.cash)
      : null;

  /* ---- add item by barcode / name ---- */
  function addToCart(text) {
    const q = text.trim().toLowerCase();
    if (!q) return;
    const p =
      products.find((x) => x.barcode === q || x.name.toLowerCase() === q) ||
      products.find((x) => x.name.toLowerCase().includes(q));
    if (!p) return toast(`No product found for "${text}"`);
    const ex = cart.findIndex((x) => x.bc === p.barcode);
    let idx;
    if (ex >= 0) {
      idx = ex;
      setCart((c) =>
        c.map((it, k) => (k === ex ? { ...it, qty: it.qty + 1 } : it)),
      );
    } else {
      idx = cart.length;
      setCart((c) => [
        ...c,
        P
          ? { bc: p.barcode, qty: 1, buy: p.buy, mrp: p.mrp }
          : { bc: p.barcode, qty: 1, price: p.mrp, disc: 0 },
      ]);
    }
    if (!P) setLastS(p.barcode);
    setSearch("");
    focusRow.current = idx;
  }
  // after an item is added, jump to its Qty box (or back to the scan box)
  useEffect(() => {
    if (focusRow.current == null) return;
    const el = root.current.querySelector(
      `#items tr.item[data-i="${focusRow.current}"] [data-f="qty"]`,
    );
    focusRow.current = null;
    focusSel(el || root.current.querySelector("#search"));
  }, [cart]);

  /* ---- save ---- */
  async function doSave(print) {
    if (saving) return;
    if (!cart.length) return toast("Add at least one item first");
    if (cart.some((i) => !(i.qty > 0)))
      return toast("Quantity must be at least 1");
    if (!P)
      for (const i of cart)
        if (i.qty > stockOf(meta.wh, i.bc))
          return toast(`Not enough ${prod(i.bc).name} in ${meta.wh}`);
    setSaving(true);
    try {
      let rec;
      if (P) {
        rec = await api("/purchases", {
          method: "POST",
          body: {
            vendor: meta.vendor,
            bill: meta.bill,
            wh: meta.wh,
            method: meta.method,
            status: meta.status,
            lines: cart.map((i) => ({
              barcode: i.bc,
              qty: i.qty,
              buy: i.buy,
              mrp: i.mrp,
            })),
          },
        });
        setCart([]);
        setMetaField({ bill: "" });
        toast(`Purchase saved · ${money(rec.total)} · stock updated`);
      } else {
        rec = await api("/sales", {
          method: "POST",
          body: {
            customer: meta.customer,
            wh: meta.wh,
            method: meta.method,
            status: meta.status,
            cash: cashShown ? cashRec : null,
            lines: cart.map((i) => ({
              barcode: i.bc,
              qty: i.qty,
              price: i.price,
              disc: i.disc,
            })),
          },
        });
        setCart([]);
        setMetaField({ cash: "" });
        setLastS(null);
        toast(
          `Sale saved · ${money(rec.total)}${rec.change > 0 ? ` · Return ${money(rec.change)}` : ""}`,
        );
      }
      setWhen(dateNow());
      await refresh();
      if (print) printDoc(m, rec, shop, toast);
    } catch (e) {
      toast(e.message);
    }
    setSaving(false);
  }
  saveRef.current = doSave;
  useEffect(() => {
    // Ctrl+S = save
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        saveRef.current(false);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  /* ---- keyboard flow: Enter = next field ---- */
  function fieldOrder() {
    const v = root.current,
      list = [];
    v.querySelectorAll(".appbar input:not([readonly]), .appbar select").forEach(
      (e) => list.push(e),
    );
    const s = v.querySelector("#search");
    if (s) list.push(s);
    v.querySelectorAll("#items tr.item").forEach((r) =>
      r.querySelectorAll("input[data-f]").forEach((e) => list.push(e)),
    );
    [
      v.querySelector('input[name="status"]:checked'),
      v.querySelector('input[name="method"]:checked'),
    ].forEach((e) => e && list.push(e));
    const cash = v.querySelector("#cash");
    if (cash) list.push(cash);
    const sv = v.querySelector('[data-act="save"]');
    if (sv) list.push(sv);
    return list;
  }
  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const t = e.target;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      doSave(true);
      return;
    }
    if (t.tagName === "BUTTON" || !t.matches("input,select")) return;
    e.preventDefault();
    if (t.id === "search") {
      if (t.value.trim()) {
        addToCart(t.value);
        return;
      }
      focusSel(
        fieldOrder().find(
          (x) =>
            !x.closest(".appbar") && x.id !== "search" && !x.closest("#items"),
        ),
      );
      return;
    }
    const o = fieldOrder(),
      row = t.closest("tr.item");
    if (row) {
      const f = [...row.querySelectorAll("input[data-f]")];
      if (t === f[f.length - 1]) {
        focusSel(root.current.querySelector("#search"));
        return;
      }
    }
    focusSel(o[o.indexOf(t) + 1]);
  };
  const onFocus = (e) => {
    // sales: show details of the row you are on
    if (P) return;
    const row = e.target.closest && e.target.closest(".item");
    if (!row) return;
    const it = cart[+row.dataset.i];
    if (it && it.bc !== lastS) setLastS(it.bc);
  };

  /* ---- pieces ---- */
  const whSelect = (
    <select
      id="wh"
      value={meta.wh}
      onChange={(e) => setMetaField({ wh: e.target.value })}
    >
      {warehouses.map((w) => (
        <option key={w}>{w}</option>
      ))}
    </select>
  );
  const invNo = P ? numFmt("PUR", next.purchase) : numFmt("SAL", next.sale);

  const appBar = (
    <div className="appbar">
      <div className="ab-title">
        <Crumb />
        <h1>{P ? "Purchase entry" : "Sales entry"}</h1>
      </div>
      <div
        className="ab-fields"
        style={{
          gridTemplateColumns: P
            ? ".9fr 1.2fr 1.3fr .9fr 1.1fr"
            : ".9fr 1.2fr 1.4fr 1.1fr",
        }}
      >
        <div className="field">
          <label className="l" htmlFor="inv">
            Invoice no
          </label>
          <input id="inv" value={invNo} readOnly />
        </div>
        <div className="field">
          <label className="l" htmlFor="when">
            Date & time
          </label>
          <input id="when" value={when} readOnly />
        </div>
        {P ? (
          <>
            <div className="field">
              <label className="l" htmlFor="vendor">
                Party / vendor
              </label>
              <input
                id="vendor"
                value={meta.vendor}
                onChange={(e) => setMetaField({ vendor: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="l" htmlFor="bill">
                Vendor bill no
              </label>
              <input
                id="bill"
                value={meta.bill}
                onChange={(e) => setMetaField({ bill: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="l" htmlFor="wh">
                Receiving warehouse
              </label>
              {whSelect}
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="l" htmlFor="customer">
                Party / customer
              </label>
              <input
                id="customer"
                value={meta.customer}
                onChange={(e) => setMetaField({ customer: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="l" htmlFor="wh">
                Selling from
              </label>
              {whSelect}
            </div>
          </>
        )}
      </div>
      <span className="badge">
        <i></i>Draft
      </span>
    </div>
  );

  const it = !P ? cart.find((i) => i.bc === lastS) : null;
  const pinfo =
    !P &&
    (!it ? (
      <div id="pinfo">
        <div className="pi-empty">
          Scan or click a product to see its full details here
        </div>
      </div>
    ) : (
      (() => {
        const p = prod(it.bc),
          netP = it.price * (1 - it.disc / 100);
        return (
          <div id="pinfo">
            <div className="pi">
              <div>
                <div className="pi-label">Product details</div>
                <div className="pi-name">{p.name}</div>
                <div className="tags">
                  <span className="tag">{p.barcode}</span>
                  <span className="tag u">per {p.unit}</span>
                </div>
              </div>
              <div className="pi-cell">
                <span>MRP</span>
                <b>{money(p.mrp)}</b>
              </div>
              <div className="pi-cell">
                <span>Selling price now</span>
                <b>{money(netP)}</b>
                {it.disc ? <em>{it.disc}% off</em> : null}
              </div>
              <div className="pi-cell">
                <span>Stock in each warehouse</span>
                <div className="stk-list">
                  {warehouses.map((w) => {
                    const q = stockOf(w, p.barcode);
                    return (
                      <span
                        key={w}
                        className={`stk ${q === 0 ? "out" : q < low ? "low" : "ok"} ${w === meta.wh ? "sel" : ""}`}
                      >
                        {w}: {q} {p.unit}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()
    ));

  const money2 = (f, v, i, name) => (
    <div className="money">
      <span>Rs.</span>
      <NumInput
        min="0"
        step="0.01"
        value={v}
        data-f={f}
        aria-label={`${f} for ${name}`}
        onChange={(n) => patchItem(i, { [f]: n })}
      />
    </div>
  );

  const rows = cart.length ? (
    cart.map((it, i) => {
      const p = prod(it.bc);
      if (!p) return null;
      const line = lineOf(m, it);
      let xCell, totSub;
      if (P) {
        const lowM = margin(it) < 5;
        xCell = (
          <>
            <span className={`pill ${lowM ? "low" : ""}`}>
              {margin(it).toFixed(1)}%
            </span>
            <span className="sm">{money(it.mrp - it.buy)} profit / unit</span>
          </>
        );
        totSub = `${it.qty} × ${money(it.buy)}`;
      } else {
        const av = stockOf(meta.wh, it.bc),
          over = it.qty > av;
        const st =
          av === 0
            ? ["out", "Out of stock"]
            : av < low
              ? ["low", "Low stock"]
              : ["ok", "In stock"];
        xCell = (
          <>
            <div>
              <b>{av}</b> <span className="unit">{p.unit}</span>
            </div>
            <span className={`stk ${st[0]}`}>{st[1]}</span>
            {over ? (
              <span className="sm bad">Only {av} available</span>
            ) : (
              <span className="sm">in {meta.wh}</span>
            )}
          </>
        );
        totSub = `${it.qty} × ${money(it.price)}${it.disc ? ` − ${it.disc}%` : ""}`;
      }
      const unitNet = !P ? it.price * (1 - it.disc / 100) : 0,
        save = !P ? (p.mrp - unitNet) * it.qty : 0;
      return (
        <tr key={it.bc} className="item" data-i={i}>
          <td className="c">
            <span className="idx" style={{ margin: "0 auto" }}>
              {i + 1}
            </span>
          </td>
          <td>
            <span className="tag">{p.barcode}</span>
          </td>
          <td>
            <div className="pname">{p.name}</div>
            <span className="tag u">per {p.unit}</span>
            {!P && (
              <div className="sm">
                MRP {money(p.mrp)}
                {save > 0.005 ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="saved">Customer saves {money(save)}</span>
                  </>
                ) : save < -0.005 ? (
                  <>
                    {" "}
                    · <span className="bad">Above MRP</span>
                  </>
                ) : null}
              </div>
            )}
          </td>
          <td>
            <div className="step">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() =>
                  patchItem(i, { qty: Math.max(1, (+it.qty || 0) - 1) })
                }
              >
                −
              </button>
              <NumInput
                min="1"
                value={it.qty}
                data-f="qty"
                aria-label={`Quantity for ${p.name}`}
                onChange={(n) => patchItem(i, { qty: n })}
              />
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() =>
                  patchItem(i, { qty: Math.max(1, (+it.qty || 0) + 1) })
                }
              >
                +
              </button>
            </div>
          </td>
          {P ? (
            <>
              <td>{money2("buy", it.buy, i, p.name)}</td>
              <td>{money2("mrp", it.mrp, i, p.name)}</td>
              <td className="c">{xCell}</td>
            </>
          ) : (
            <>
              <td>{money2("price", it.price, i, p.name)}</td>
              <td>
                <div className="money pct">
                  <NumInput
                    min="0"
                    max="100"
                    step="0.5"
                    value={it.disc}
                    data-f="disc"
                    aria-label={`Discount percent for ${p.name}`}
                    onChange={(n) => patchItem(i, { disc: n })}
                  />
                  <span>%</span>
                </div>
              </td>
              <td>{xCell}</td>
            </>
          )}
          <td className="tot">
            <b>{money(line)}</b>
            <span className="sm">{totSub}</span>
          </td>
          <td className="c">
            <button
              className="x"
              aria-label={`Remove ${p.name}`}
              style={{ margin: "0 auto" }}
              onClick={() => setCart((c) => c.filter((_, k) => k !== i))}
            >
              <Icon name="x" />
            </button>
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan="9">
        <div className="empty" style={{ margin: "6px 0" }}>
          No items yet.
          <br />
          Scan a barcode or type a product name above.
        </div>
      </td>
    </tr>
  );

  const itemsCard = (
    <section className="inv-items">
      <CardTitle icon="products">Items</CardTitle>
      <div className="scanrow">
        <div className="scan">
          <Icon name="scan" />
          <input
            id="search"
            list="plist"
            placeholder="Scan barcode or type product name, then press Enter"
            aria-label="Scan barcode or type product name"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn green add" onClick={() => addToCart(search)}>
          Add item
        </button>
        <datalist id="plist">
          {products.map((p) => (
            <option key={p.barcode} value={p.name}>
              {p.barcode}
            </option>
          ))}
        </datalist>
      </div>
      <div className="flowhint">
        <kbd>Enter ↵</kbd> moves to the next field: Scan / name → Qty →{" "}
        {P ? "Purchase price → MRP" : "Price → Discount"} → next item
      </div>
      {pinfo}
      <div className="listhead">
        <div className="count">
          {cart.length} item{cart.length === 1 ? "" : "s"}{" "}
          <span>· {units} units</span>
        </div>
        <button className="linkbtn" onClick={() => setCart([])}>
          Clear all
        </button>
      </div>
      <div className="itbl-wrap">
        <table className="tbl itbl">
          <thead>
            <tr>
              <th className="c" style={{ width: 48 }}>
                #
              </th>
              <th style={{ width: 150 }}>Barcode</th>
              <th>Product</th>
              <th className="c" style={{ width: 136 }}>
                Qty
              </th>
              {P ? (
                <>
                  <th className="r" style={{ width: 142 }}>
                    Purchase price
                  </th>
                  <th className="r" style={{ width: 142 }}>
                    Selling price (MRP)
                  </th>
                  <th className="c" style={{ width: 132 }}>
                    Margin
                  </th>
                </>
              ) : (
                <>
                  <th style={{ width: 142 }}>Selling price</th>
                  <th style={{ width: 112 }}>Discount</th>
                  <th style={{ width: 136 }}>In stock</th>
                </>
              )}
              <th className="r" style={{ width: 146 }}>
                Line total
              </th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody id="items">{rows}</tbody>
          <tfoot>
            {cart.length ? (
              <tr>
                <td colSpan="3" className="r">
                  Total · {cart.length} item{cart.length === 1 ? "" : "s"}
                </td>
                <td className="c">
                  <b>{units}</b> units
                </td>
                <td colSpan="3"></td>
                <td className="tot">
                  <b>{money(net)}</b>
                </td>
                <td></td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>
    </section>
  );

  const seg = (name, opts, cur) => (
    <div className="seg" role="radiogroup" aria-label={name}>
      {opts.map((o, k) => (
        <span key={o} style={{ display: "contents" }}>
          <input
            type="radio"
            name={name}
            id={`${name}${k}`}
            value={o}
            checked={o === cur}
            onChange={() => setMetaField({ [name]: o })}
          />
          <label htmlFor={`${name}${k}`}>{o}</label>
        </span>
      ))}
    </div>
  );

  let balCls = "idle",
    balLabel = "Enter the cash received to see the balance",
    balVal = "";
  if (cashRec !== null) {
    if (cashRec >= net - 0.005) {
      balCls = "ok";
      balLabel = "Balance to return to customer";
      balVal = money(Math.max(0, cashRec - net));
    } else {
      balCls = "due";
      balLabel = "Customer still owes (balance due)";
      balVal = money(net - cashRec);
    }
  }
  const cashBox = cashShown && (
    <div id="cashbox">
      <div className="field">
        <label className="l" htmlFor="cash">
          Cash received from customer
        </label>
        <div className="money big">
          <span>Rs.</span>
          <input
            id="cash"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={meta.cash}
            onChange={(e) => setMetaField({ cash: e.target.value })}
          />
        </div>
      </div>
      <div className="quick">
        <button
          type="button"
          className="chipbtn"
          onClick={() => {
            setMetaField({ cash: String(Math.round(net * 100) / 100) });
            focusSel(root.current.querySelector("#cash"));
          }}
        >
          Exact amount
        </button>
        {[500, 1000, 2000, 5000].map((v) => (
          <button
            key={v}
            type="button"
            className="chipbtn"
            onClick={() => {
              setMetaField({ cash: String(v) });
              focusSel(root.current.querySelector("#cash"));
            }}
          >
            {v.toLocaleString("en-LK")}
          </button>
        ))}
      </div>
      <div className={`balance ${balCls}`}>
        <span>{balLabel}</span>
        {balVal ? <b>{balVal}</b> : null}
      </div>
    </div>
  );

  const gross = cart.reduce((s, i) => s + (P ? 0 : i.qty * i.price), 0);
  const avgMargin = cart.length
    ? cart.reduce((s, i) => s + margin(i), 0) / cart.length
    : 0;

  return (
    <div ref={root} onKeyDown={onKeyDown} onFocus={onFocus} className="invoice">
      {appBar}
      {itemsCard}
      <div className="inv-foot">
        <section className="inv-pay">
          <CardTitle icon="card">Payment</CardTitle>
          <div className="pay-gap">
            <div>
              <div className="lbl" style={{ marginBottom: 8 }}>
                Status
              </div>
              {seg("status", ["Paid", "Pending", "Partial"], meta.status)}
            </div>
            <div>
              <div className="lbl" style={{ marginBottom: 8 }}>
                Method
              </div>
              {seg(
                "method",
                ["Cash", "Card", "Bank transfer", "Cheque"],
                meta.method,
              )}
            </div>
            {cashBox}
          </div>
        </section>
        <section className="inv-sum">
          <CardTitle icon="doc">
            {P ? "Purchase summary" : "Sale summary"}
          </CardTitle>
          <div>
            <div className="sumrow">
              <span>Items</span>
              <b>
                {cart.length} product{cart.length === 1 ? "" : "s"}, {units}{" "}
                unit{units === 1 ? "" : "s"}
              </b>
            </div>
            {P ? (
              <div className="sumrow">
                <span>Average margin</span>
                <b>{avgMargin.toFixed(1)}%</b>
              </div>
            ) : (
              <>
                <div className="sumrow">
                  <span>Subtotal</span>
                  <b>{money(gross)}</b>
                </div>
                <div className="sumrow">
                  <span>Discount</span>
                  <b>− {money(gross - net)}</b>
                </div>
              </>
            )}
            <div className="grand">
              <span>Grand total</span>
              <b>{money(net)}</b>
            </div>
            {!P && cashShown && cashRec !== null && (
              <>
                <div className="sumrow">
                  <span>Cash received</span>
                  <b>{money(cashRec)}</b>
                </div>
                <div className="sumrow">
                  <span>
                    {cashRec >= net - 0.005
                      ? "Balance to return"
                      : "Balance due"}
                  </span>
                  <b
                    style={{
                      color:
                        cashRec >= net - 0.005
                          ? "var(--leaf)"
                          : "var(--danger)",
                    }}
                  >
                    {money(Math.abs(cashRec - net))}
                  </b>
                </div>
              </>
            )}
          </div>
          <div className="actions">
            <button
              className="btn"
              onClick={() => {
                setCart([]);
                toast(P ? "Purchase cancelled" : "Sale cancelled");
              }}
            >
              Cancel
            </button>
            <button
              className="btn dark"
              data-act="save"
              disabled={saving}
              onClick={() => doSave(false)}
            >
              {P ? "Save purchase" : "Save sale"}
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => doSave(true)}
            >
              <Icon name="print" />
              Save &amp; Print
            </button>
          </div>
          <div className="kbd-hint">
            <kbd>Enter ↵</kbd> next field · <kbd>Ctrl</kbd>+<kbd>S</kbd> save ·{" "}
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> save &amp; print
          </div>
        </section>
      </div>
    </div>
  );
}
