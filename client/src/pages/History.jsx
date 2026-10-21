import Icon from "../components/Icon";
import { CardTitle, KpiRow, Loading, PageHeader, StatusBadge, useFetch } from "../components/ui";
import { useData } from "../context/DataContext";
import { useNav } from "../context/NavContext";
import { useToast } from "../context/ToastContext";
import { money, dateOf } from "../lib/format";
import { printDoc } from "../lib/printDoc";

export function HistoryPage({ kind }) {
  const P = kind === "P";
  const { data, loading, error } = useFetch(P ? "/purchases" : "/sales");
  const { shop } = useData();
  const { go, page } = useNav();
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <div className="empty">{error}</div>;
  const list = data, total = list.reduce((s, x) => s + x.total, 0), unpaid = list.filter(x => x.status !== "Paid").reduce((s, x) => s + x.total, 0);
  return (<>
    <PageHeader title={P ? "Purchase history" : "Sales history"} desc={P ? "All saved purchase bills" : "All saved sales bills"}
      right={<button className="btn green" onClick={() => go(page, "new")}>+ {P ? "New purchase" : "New sale"}</button>} />
    <KpiRow items={[["Bills", list.length, "a"], ["Total amount", money(total), "b"], ["Not fully paid", money(unpaid), "d"]]} />
    <section className="card"><CardTitle icon="doc">{P ? "Purchase bills" : "Sales bills"}</CardTitle>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Invoice</th><th>{P ? "Supplier" : "Customer"}</th><th>Date</th><th>Billed by</th><th className="r">Units</th><th>Status</th><th className="r">Amount</th><th></th></tr></thead>
        <tbody>
          {list.length ? list.map(r => (
            <tr key={r.no}><td><b>{r.no}</b></td><td>{r.party}</td><td>{dateOf(r.ts)}</td><td>{r.by || "—"}</td><td className="r">{r.units}</td>
              <td><StatusBadge status={r.status} /></td><td className="r"><b>{money(r.total)}</b></td>
              <td className="r"><button className="btn sm" onClick={() => printDoc(kind, r, shop, toast)}><Icon name="print" /> Print</button></td></tr>
          )) : <tr><td colSpan="8" style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>Nothing saved yet</td></tr>}
        </tbody></table></div></section>
  </>);
}

export function SuppliersPage() {
  const { data, loading, error } = useFetch("/purchases/suppliers");
  const { go } = useNav();
  if (loading) return <Loading />;
  if (error) return <div className="empty">{error}</div>;
  return (<>
    <PageHeader title="Suppliers" desc="Who you buy from and how much" right={<button className="btn green" onClick={() => go("purchase", "new")}>+ New purchase</button>} />
    <section className="card"><CardTitle icon="staff">Supplier list</CardTitle>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Supplier</th><th className="r">Bills</th><th className="r">Units</th><th>Last purchase</th><th className="r">Not paid</th><th className="r">Total bought</th></tr></thead>
        <tbody>{data.map(o => (
          <tr key={o.name}>
            <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="avatar" style={{ background: "var(--leaf-soft)", color: "var(--leaf)" }}>{o.name[0]}</div><b>{o.name}</b></div></td>
            <td className="r">{o.n}</td><td className="r">{o.u}</td><td>{dateOf(o.last)}</td>
            <td className="r">{o.due ? <span className="low-badge">{money(o.due)}</span> : "—"}</td><td className="r"><b>{money(o.t)}</b></td>
          </tr>))}</tbody></table></div></section>
  </>);
}
