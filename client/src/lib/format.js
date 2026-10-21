export const money = n => "Rs. " + (+n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const n2 = v => (+v || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const numFmt = (p, n) => p + "-" + String(n).padStart(5, "0");
export const dateNow = () => new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const dateOf = ts => new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const dateTimeOf = ts => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const margin = it => (it.mrp > 0 ? ((it.mrp - it.buy) / it.mrp) * 100 : 0);
// line total: purchase = qty x buy, sale = qty x price less discount %
export const lineOf = (m, it) => (m === "P" ? it.qty * it.buy : it.qty * it.price * (1 - it.disc / 100));
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
