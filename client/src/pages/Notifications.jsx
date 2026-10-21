import { useMemo, useState } from "react";
import { CardTitle, KpiRow, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNav } from "../context/NavContext";
import { useEntry } from "../context/EntryContext";
import { useToast } from "../context/ToastContext";

// Stock alerts: every product with fewer than `alert` units in a warehouse (shown for both the
// stock-product side and the warehouse side of the app).
export function NotificationsPage() {
  const { alertItems, alert, warehouses, markSeen } = useData();
  const { can } = useAuth();
  const { go } = useNav();
  const { P } = useEntry();
  const toast = useToast();
  const [wh, setWh] = useState("");
  const [view, setView] = useState("all"); // all | new
  const all = alertItems();
  const items = useMemo(
    () => all.filter((a) => (!wh || a.w === wh) && (view === "all" || !a.seen)),
    [all, wh, view],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const out = all.filter((a) => a.out).length,
    fresh = all.filter((a) => !a.seen).length;
  const whCount = (w) => all.filter((a) => a.w === w).length;

  const restock = (a) => {
    P.setCart((c) =>
      c.find((i) => i.bc === a.p.barcode)
        ? c
        : [...c, { bc: a.p.barcode, qty: 50, buy: a.p.buy, mrp: a.p.mrp }],
    );
    P.setMeta((x) => ({ ...x, wh: a.w }));
    go("purchase", "new");
    toast(`${a.p.name} added to a new purchase (50 ${a.p.unit})`);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        desc={`Alerts for any product under ${alert} units, in stock products and in every warehouse`}
        right={
          fresh > 0 && (
            <button className="btn" onClick={() => markSeen(all)}>
              Mark all as read
            </button>
          )
        }
      />
      <KpiRow
        items={[
          ["Total alerts", all.length, "d"],
          ["New (unread)", fresh, "b"],
          ["Out of stock", out, "d"],
          ["Warehouses affected", new Set(all.map((a) => a.w)).size, "c"],
        ]}
      />
      <section className="card">
        <CardTitle icon="notifications">Stock alerts</CardTitle>
        <div className="tabs">
          <button
            className={`tab ${wh === "" ? "on" : ""}`}
            onClick={() => setWh("")}
          >
            All warehouses ({all.length})
          </button>
          {warehouses.map((w) => (
            <button
              key={w}
              className={`tab ${wh === w ? "on" : ""}`}
              onClick={() => setWh(w)}
            >
              {w} ({whCount(w)})
            </button>
          ))}
          <span className="grow" />
          <div className="range" role="group" aria-label="Filter">
            <button
              type="button"
              className={view === "all" ? "on" : ""}
              onClick={() => setView("all")}
            >
              All
            </button>
            <button
              type="button"
              className={view === "new" ? "on" : ""}
              onClick={() => setView("new")}
            >
              Unread
            </button>
          </div>
        </div>
        {items.length ? (
          <ul className="notes">
            {items.map((a) => (
              <li
                key={a.key}
                className={`note ${a.out ? "out" : "low"} ${a.seen ? "read" : ""}`}
              >
                <div className="note-ic" aria-hidden="true">
                  {a.out ? "✕" : "!"}
                </div>
                <div className="note-tx">
                  <b>{a.p.name}</b>{" "}
                  {a.out
                    ? "is out of stock"
                    : `has only ${a.q} ${a.p.unit} left`}
                  <span>
                    {a.w} · stock product{" "}
                    <span className="tag">{a.p.barcode}</span> · alert level{" "}
                    {alert} {a.p.unit}
                  </span>
                </div>
                <span className={a.out ? "low-badge" : "tag u"}>
                  {a.q} {a.p.unit}
                </span>
                <div className="note-act">
                  {can("purchase") && (
                    <button className="btn sm green" onClick={() => restock(a)}>
                      Restock
                    </button>
                  )}
                  {!a.seen && (
                    <button className="btn sm" onClick={() => markSeen([a])}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty" style={{ border: 0 }}>
            {all.length
              ? "No alerts match this filter."
              : "All good. Nothing is under the alert level. 🎉"}
          </div>
        )}
      </section>
    </>
  );
}
