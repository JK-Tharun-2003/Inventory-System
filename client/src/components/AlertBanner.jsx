import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { useNav } from "../context/NavContext";

// Red strip shown on the Products and Warehouse pages when something is under the alert level
export default function AlertBanner({ scope, warehouse }) {
  const { alertItems, alert } = useData();
  const { can } = useAuth();
  const { go } = useNav();
  const all = alertItems();
  const items = warehouse ? all.filter(a => a.w === warehouse) : all;
  if (!items.length) return null;
  const names = [...new Set(items.map(a => a.p.name))];
  const out = items.filter(a => a.out).length;
  const where = scope === "warehouse" ? (warehouse ? `in ${warehouse}` : "in your warehouses") : "across your warehouses";
  return (
    <div className="alertbar" role="alert">
      <div className="alertbar-ic" aria-hidden="true">⚠</div>
      <div className="alertbar-tx">
        <b>{items.length} stock alert{items.length === 1 ? "" : "s"}: under {alert} units {where}</b>
        <span>{names.slice(0, 4).join(", ")}{names.length > 4 ? ` and ${names.length - 4} more` : ""}{out ? ` · ${out} out of stock` : ""}</span>
      </div>
      {can("notifications") && <button type="button" className="btn sm" onClick={() => go("notifications", "all")}>View notifications</button>}
    </div>
  );
}
