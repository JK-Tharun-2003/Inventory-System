import { useEffect, useRef } from "react";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import { Loading } from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { useData } from "./context/DataContext";
import { useNav } from "./context/NavContext";
import { useToast } from "./context/ToastContext";
import EntryPage from "./pages/EntryPage";
import { HistoryPage, SuppliersPage } from "./pages/History";
import { ProductsPage, ProductAddPage, ProductModifyPage, GroupsPage } from "./pages/Products";
import { WarehousePage, LowStockPage, TransferPage } from "./pages/Warehouse";
import { StaffPage, StaffAddPage, AdminSettingsPage } from "./pages/Staff";
import { NotificationsPage } from "./pages/Notifications";
import { ReportsPage, PartyReportPage, StockReportPage } from "./pages/Reports";

// Same page map as the prototype: "section/sub-page" -> screen
const VIEWS = {
  "sales/new": () => <EntryPage kind="S" />, "sales/history": () => <HistoryPage kind="S" />,
  "purchase/new": () => <EntryPage kind="P" />, "purchase/history": () => <HistoryPage kind="P" />, "purchase/suppliers": SuppliersPage,
  "products/all": ProductsPage, "products/add": ProductAddPage, "products/modify": ProductModifyPage, "products/groups": GroupsPage,
  "warehouse/overview": WarehousePage, "warehouse/low": LowStockPage, "warehouse/transfer": TransferPage,
  "notifications/all": NotificationsPage,
  "staff/team": StaffPage, "staff/add": StaffAddPage, "staff/settings": AdminSettingsPage,
  "reports/summary": ReportsPage, "reports/sales": () => <PartyReportPage kind="S" />, "reports/purchases": () => <PartyReportPage kind="P" />, "reports/stock": StockReportPage
};

const NoAccess = () => (
  <section className="card noacc"><div className="pname" style={{ fontSize: "var(--fs-lg)" }}>No pages assigned yet</div>
    <div className="sub">Ask the admin to give you access from <b>Staff access</b>.</div></section>
);

function Shell() {
  const { can } = useAuth();
  const { ready } = useData();
  const { page, sub } = useNav();
  const { unseenCount, alert } = useData();
  const toast = useToast();
  const told = useRef(false);
  // Once per sign-in: tell the person if anything is under the alert level
  useEffect(() => {
    if (!ready || told.current || !can("notifications")) return;
    told.current = true;
    const n = unseenCount();
    if (n > 0) toast(`${n} stock alert${n === 1 ? "" : "s"}: products under ${alert} units`);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  let body;
  if (page === "none" || !can(page)) body = <NoAccess />;
  else if (!ready) body = <Loading />;
  else { const View = VIEWS[page + "/" + sub] || VIEWS["sales/new"]; body = <View key={page + "/" + sub} />; }
  return (
    <div className="app">
      <Sidebar />
      <main id="view"><div className="page">{body}</div></main>
    </div>
  );
}

export default function App() {
  const { user, booting } = useAuth();
  if (booting) return <div className="loading">Loading…</div>;
  return user ? <Shell /> : <Login />;
}
