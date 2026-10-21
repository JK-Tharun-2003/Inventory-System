import { useState } from "react";
import LineChart from "./LineChart";
import { CardTitle, Loading, useFetch } from "./ui";
import { money } from "../lib/format";

const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];
const SERIES = {
  sales: { name: "Sales", color: "#1F8A63" },
  purchases: { name: "Purchases", color: "#F2A93B" }
};
const label = d => { const [, m, day] = d.split("-"); return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1]}`; };

// Line graph card used on the report pages. `show` picks which lines to draw.
export default function TrendCard({ title, show = ["sales", "purchases"], initial = 30 }) {
  const [days, setDays] = useState(initial);
  const r = useFetch(`/reports/trend?days=${days}`);
  const rows = r.data?.days || [];
  return (
    <section className="card trend">
      <CardTitle icon="reports" extra={
        <div className="range" role="group" aria-label="Date range">
          {RANGES.map(([d, l]) => <button key={d} type="button" className={d === days ? "on" : ""} aria-pressed={d === days} onClick={() => setDays(d)}>{l}</button>)}
        </div>}>{title}</CardTitle>
      {r.error ? <div className="empty">{r.error}</div> : !r.data ? <Loading /> : (
        <LineChart labels={rows.map(x => label(x.date))} format={money}
          series={show.map(k => ({ ...SERIES[k], values: rows.map(x => x[k]) }))} />
      )}
    </section>
  );
}
