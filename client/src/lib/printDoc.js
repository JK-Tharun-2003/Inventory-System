import { esc, n2, dateTimeOf } from "./format";

export function docHTML(kind, r, shop) {
  const P = kind === "P", L = r.lines || [];
  const rows = L.length
    ? L.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}<br><small>${esc(l.barcode)}</small></td><td class="r">${l.qty} ${esc(l.unit)}</td><td class="r">${n2(P ? l.buy : l.price)}</td>${P ? "" : `<td class="r">${l.disc ? l.disc + "%" : "—"}</td>`}<td class="r">${n2(l.total)}</td></tr>`).join("")
    : `<tr><td>1</td><td>Items (${r.units} units)</td><td class="r">${r.units}</td><td></td>${P ? "" : "<td></td>"}<td class="r">${n2(r.total)}</td></tr>`;
  const gross = !P && L.length ? L.reduce((s, l) => s + l.qty * l.price, 0) : r.total, disc = gross - r.total;
  const paid = r.received != null ? r.received : r.status === "Paid" ? r.total : 0, due = Math.max(0, r.total - paid);
  const info = (P ? [["Supplier", r.party], ["Supplier bill no", r.bill || "—"], ["Received at", r.wh || "—"]] : [["Customer", r.party], ["Sold from", r.wh || "—"]])
    .concat(r.by ? [["Served by", r.by]] : []);
  const tr = (k, v, cls) => `<tr class="${cls || ""}"><td>${k}</td><td class="r">${v}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.no)}</title><style>
    @page { margin:12mm; }
    * { box-sizing:border-box; } body { font-family:"Segoe UI",Arial,sans-serif; font-size:13px; color:#16231F; margin:0; }
    .wrap { max-width:720px; margin:0 auto; padding:8px; }
    .shop { text-align:center; border-bottom:2px solid #16231F; padding-bottom:10px; margin-bottom:12px; }
    .shop h1 { margin:0; font-size:22px; } .shop div { color:#555; margin-top:3px; }
    .meta { display:flex; justify-content:space-between; gap:20px; margin-bottom:12px; }
    .meta b { font-size:15px; } .meta div div { margin-top:3px; }
    table.items { width:100%; border-collapse:collapse; } table.items th { text-align:left; border-top:1.5px solid #16231F; border-bottom:1.5px solid #16231F; padding:7px 6px; background:#f3f3f3; }
    table.items td { padding:7px 6px; border-bottom:1px solid #ddd; vertical-align:top; } small { color:#777; }
    .r { text-align:right; } table.tot { margin:12px 0 0 auto; width:300px; border-collapse:collapse; } table.tot td { padding:4px 6px; }
    table.tot tr.g td { font-size:17px; font-weight:700; border-top:1.5px solid #16231F; padding-top:8px; }
    .foot { text-align:center; margin-top:26px; color:#555; border-top:1px dashed #999; padding-top:10px; }
  </style></head><body><div class="wrap">
    <div class="shop"><h1>${esc(shop.name)}</h1><div>${esc(shop.line)}</div></div>
    <div class="meta"><div><b>${P ? "PURCHASE BILL" : "INVOICE"}</b><div>No: <b>${esc(r.no)}</b></div><div>Date: ${dateTimeOf(r.ts)}</div></div>
    <div>${info.map(([k, v]) => `<div>${k}: <b>${esc(v)}</b></div>`).join("")}</div></div>
    <table class="items"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">${P ? "Cost" : "Price"}</th>${P ? "" : '<th class="r">Disc</th>'}<th class="r">Amount (Rs.)</th></tr></thead><tbody>${rows}</tbody></table>
    <table class="tot">
      ${disc > 0.005 ? tr("Subtotal", n2(gross)) + tr("Discount", "− " + n2(disc)) : ""}
      ${tr("Grand total", "Rs. " + n2(r.total), "g")}
      ${tr("Payment", esc(r.status) + (r.method ? " · " + esc(r.method) : ""))}
      ${!P && r.received != null && r.method === "Cash" ? tr("Cash received", "Rs. " + n2(r.received + (r.change || 0))) : ""}
      ${!P && r.change > 0 ? tr("Balance returned", "Rs. " + n2(r.change)) : ""}
      ${due > 0.005 ? tr("Balance due", "Rs. " + n2(due)) : ""}
    </table>
    <div class="foot">${P ? "Goods received in good condition." : "Thank you, please visit again!"}</div>
  </div></body></html>`;
}

export function printHTML(html, onError) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(() => {
    try { f.contentWindow.onafterprint = () => f.remove(); f.contentWindow.focus(); f.contentWindow.print(); }
    catch (e) { onError && onError("Printing is not available in this browser"); }
    setTimeout(() => f.remove(), 60000);
  }, 300);
}

export const printDoc = (kind, rec, shop, onError) => printHTML(docHTML(kind, rec, shop), onError);
