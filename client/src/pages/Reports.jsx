import {
  CardTitle,
  KpiRow,
  Loading,
  PageHeader,
  useFetch,
} from "../components/ui";
import TrendCard from "../components/TrendCard";
import { money, dateOf } from "../lib/format";

const Wait = ({ r }) =>
  r.loading ? (
    <Loading />
  ) : r.error ? (
    <div className="empty">{r.error}</div>
  ) : null;

export function ReportsPage() {
  const r = useFetch("/reports/summary");
  if (!r.data) return <Wait r={r} />;
  const {
      totalSales: ts,
      totalPurchases: tp,
      stockValue: sv,
      low,
      recent,
    } = r.data,
    max = Math.max(ts, tp, 1);
  return (
    <>
      <PageHeader title="Reports" desc="How the business is doing" />
      <div className="kpis">
        <div className="kpi a">
          <div className="k">Total sales</div>
          <div className="v">{money(ts)}</div>
        </div>
        <div className="kpi b">
          <div className="k">Total purchases</div>
          <div className="v">{money(tp)}</div>
        </div>
        <div className="kpi c">
          <div className="k">Stock value</div>
          <div className="v">{money(sv)}</div>
        </div>
        <div className="kpi d">
          <div className="k">Low stock items</div>
          <div className="v">{low.length}</div>
        </div>
      </div>
      <TrendCard title="Sales & purchases trend" />
      <div className="bottom">
        <section className="card">
          <CardTitle icon="reports">Sales vs purchases</CardTitle>
          <div className="bar">
            <b>Sales</b>
            <div className="track">
              <div
                className="fill"
                style={{
                  width: `${(ts / max) * 100}%`,
                  background: "var(--leaf)",
                }}
              ></div>
            </div>
            <b style={{ textAlign: "right" }}>{money(ts)}</b>
          </div>
          <div className="bar">
            <b>Purchases</b>
            <div className="track">
              <div
                className="fill"
                style={{
                  width: `${(tp / max) * 100}%`,
                  background: "var(--saffron)",
                }}
              ></div>
            </div>
            <b style={{ textAlign: "right" }}>{money(tp)}</b>
          </div>
          <div className="sub" style={{ marginTop: 14 }}>
            Gross difference:{" "}
            <b style={{ color: "var(--ink)" }}>{money(ts - tp)}</b>
          </div>
        </section>
        <section className="card">
          <CardTitle icon="warehouse">Low stock (under 20)</CardTitle>
          {low.length ? (
            low.map((l) => (
              <div className="sumrow" key={l.w + l.name}>
                <span>
                  <b style={{ color: "var(--ink)" }}>{l.name}</b> · {l.w}
                </span>
                <span className="low-badge">
                  {l.q} {l.unit} left
                </span>
              </div>
            ))
          ) : (
            <div className="sub">Everything is well stocked.</div>
          )}
        </section>
      </div>
      <section className="card">
        <CardTitle icon="doc">Recent transactions</CardTitle>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Type</th>
                <th>Invoice</th>
                <th>Party</th>
                <th>Date</th>
                <th>Status</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((x) => (
                <tr key={x.no}>
                  <td>
                    <span className={x.t === "Sale" ? "ok-badge" : "tag u"}>
                      {x.t}
                    </span>
                  </td>
                  <td>
                    <b>{x.no}</b>
                  </td>
                  <td>{x.party}</td>
                  <td>{dateOf(x.ts)}</td>
                  <td>{x.status}</td>
                  <td className="r">
                    <b>{money(x.total)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function PartyReportPage({ kind }) {
  const P = kind === "P";
  const r = useFetch(`/reports/party/${P ? "purchases" : "sales"}`);
  if (!r.data) return <Wait r={r} />;
  const { rows, total, bills, units } = r.data;
  return (
    <>
      <PageHeader
        title={P ? "Purchase report" : "Sales report"}
        desc={P ? "Spending by supplier" : "Sales by customer"}
      />
      <KpiRow
        items={[
          ["Total", money(total), "a"],
          ["Bills", bills, "b"],
          ["Average bill", money(bills ? total / bills : 0), "c"],
          ["Units", units, "d"],
        ]}
      />
      <TrendCard
        title={P ? "Purchases over time" : "Sales over time"}
        show={[P ? "purchases" : "sales"]}
      />
      <section className="card">
        <CardTitle icon="reports">
          {P ? "By supplier" : "By customer"}
        </CardTitle>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{P ? "Supplier" : "Customer"}</th>
                <th className="r">Bills</th>
                <th className="r">Units</th>
                <th style={{ width: "30%" }}>Share</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.name}>
                  <td>
                    <b>{o.name}</b>
                  </td>
                  <td className="r">{o.n}</td>
                  <td className="r">{o.u}</td>
                  <td>
                    <div className="track">
                      <div
                        className="fill"
                        style={{
                          width: `${total ? (o.t / total) * 100 : 0}%`,
                          background: P ? "var(--saffron)" : "var(--leaf)",
                        }}
                      ></div>
                    </div>
                  </td>
                  <td className="r">
                    <b>{money(o.t)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function StockReportPage() {
  const r = useFetch("/reports/stock");
  if (!r.data) return <Wait r={r} />;
  const { warehouses: W, rows, totals, lowStock, products } = r.data;
  return (
    <>
      <PageHeader
        title="Stock report"
        desc="Quantity and value of every product by warehouse"
      />
      <KpiRow
        items={[
          ["Total units", totals.q, "a"],
          ["Stock value (cost)", money(totals.value), "c"],
          ["Products", products, "b"],
        ]}
      />
      <section className="card">
        <CardTitle icon="warehouse">Stock by warehouse</CardTitle>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                {W.map((w) => (
                  <th key={w} className="r">
                    {w}
                  </th>
                ))}
                <th className="r">Total</th>
                <th className="r">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.name}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  {x.qs.map((q, i) => (
                    <td key={i} className="r">
                      {q < lowStock ? (
                        <span className="low-badge">{q}</span>
                      ) : (
                        q
                      )}
                    </td>
                  ))}
                  <td className="r">
                    <b>{x.q}</b>
                  </td>
                  <td className="r">{money(x.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <b>Total</b>
                </td>
                {totals.perWarehouse.map((q, i) => (
                  <td key={i} className="r">
                    <b>{q}</b>
                  </td>
                ))}
                <td className="r">
                  <b>{totals.q}</b>
                </td>
                <td className="r">
                  <b>{money(totals.value)}</b>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}
