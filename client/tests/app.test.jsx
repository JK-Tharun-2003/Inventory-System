import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, test, expect } from "vitest";
import React from "react";
import App from "../src/App";
import { ToastProvider } from "../src/context/ToastContext";
import { AuthProvider } from "../src/context/AuthContext";
import { DataProvider } from "../src/context/DataContext";
import { EntryProvider } from "../src/context/EntryContext";
import { NavProvider } from "../src/context/NavContext";

let db, calls;
const reset = () => {
  calls = [];
  db = {
    products: [
      { barcode: "8901234500001", name: "Samba rice", unit: "kg", group: "Grocery", buy: 225, mrp: 260 },
      { barcode: "8901234500004", name: "Sugar", unit: "kg", group: "Grocery", buy: 235, mrp: 270 }
    ],
    groups: ["Grocery", "Dairy"], warehouses: ["Main store", "Branch store"],
    stock: { "Main store": { "8901234500001": 120, "8901234500004": 80 }, "Branch store": { "8901234500001": 10, "8901234500004": 25 } },
    shop: { name: "Test Shop", line: "Kandy" }, next: { purchase: 12, sale: 42 }, lowStock: 20, alertStock: 10
  };
};
const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const user = { type: "admin", name: "Admin", role: "Admin", perms: { sales: 1, purchase: 1, products: 1, warehouse: 1, reports: 1 } };
global.fetch = vi.fn((url, opt = {}) => {
  const path = url.replace("/api", ""), method = opt.method || "GET", body = opt.body ? JSON.parse(opt.body) : undefined;
  calls.push({ method, path, body });
  if (path === "/auth/staff-names") return ok(["Kajaa", "Nimali"]);
  if (path === "/auth/login") return ok({ token: "t", user });
  if (path === "/auth/me") return ok(user);
  if (path === "/bootstrap") return ok(JSON.parse(JSON.stringify(db)));
  if (path === "/sales" && method === "POST") {
    body.lines.forEach(l => { db.stock[body.wh][l.barcode] -= l.qty; });
    const total = body.lines.reduce((s, l) => s + l.qty * l.price * (1 - l.disc / 100), 0);
    db.next.sale++;
    return ok({ no: "SAL-00042", party: body.customer, total, units: 1, status: body.status, method: body.method, wh: body.wh, ts: Date.now(), lines: [], change: 0 });
  }
  if (path === "/sales") return ok([{ no: "SAL-00041", party: "Walk-in customer", total: 5120, units: 18, ts: Date.now(), status: "Paid", by: "Admin" }]);
  if (path === "/purchases") return ok([{ no: "PUR-00011", party: "Lanka Foods", total: 28400, units: 110, ts: Date.now(), status: "Pending" }]);
  if (path === "/purchases/suppliers") return ok([{ name: "Lanka Foods", n: 1, u: 110, t: 28400, due: 28400, last: Date.now() }]);
  if (path === "/transfers") return ok([]);
  if (path === "/staff") return ok([{ id: "1", name: "Kajaa", role: "Manager", perms: { sales: true, purchase: true, products: true, warehouse: true, reports: true } }]);
  if (path === "/reports/summary") return ok({ totalSales: 100, totalPurchases: 50, stockValue: 9999, low: [{ w: "Branch store", name: "Samba rice", unit: "kg", q: 10 }], recent: [{ no: "SAL-1", party: "X", ts: Date.now(), status: "Paid", total: 100, t: "Sale" }] });
  if (path.startsWith("/reports/party/")) return ok({ rows: [{ name: "Nimal", n: 2, u: 5, t: 300 }], total: 300, bills: 2, units: 5 });
  if (path.startsWith("/reports/trend")) return ok({ days: ["2026-10-07", "2026-10-08", "2026-10-09"].map((date, i) => ({ date, sales: 100 * (i + 1), purchases: 50 * (i + 1), bills: 1 })), totals: { sales: 600, purchases: 300 } });
  if (path.startsWith("/products/") && method === "PATCH") { const p = db.products.find(x => x.barcode === path.split("/")[2]); Object.assign(p, body); return ok(p); }
  if (path === "/reports/stock") return ok({ warehouses: ["Main store", "Branch store"], rows: [{ name: "Sugar", qs: [80, 25], q: 105, value: 24675 }], totals: { perWarehouse: [80, 25], q: 105, value: 24675 }, lowStock: 20, products: 1 });
  return Promise.reject(new Error("unmocked " + method + " " + path));
});

const Root = () => (
  <ToastProvider><AuthProvider><DataProvider><EntryProvider><NavProvider><App /></NavProvider></EntryProvider></DataProvider></AuthProvider></ToastProvider>
);
beforeEach(() => { cleanup(); reset(); sessionStorage.clear(); });

async function login(u) {
  render(<Root />);
  await u.type(await screen.findByPlaceholderText("Enter password"), "admin123{Enter}");
  await screen.findByText("Sales entry");
}

test("login, add item by name, edit, save sale", async () => {
  const u = userEvent.setup();
  await login(u);
  const search = screen.getByPlaceholderText(/Scan barcode/);
  await u.type(search, "Sugar{Enter}");
  const row = (await screen.findAllByText("Sugar")).map(e => e.closest("tr")).find(Boolean);
  const qty = within(row).getByLabelText("Quantity for Sugar");
  expect(qty).toHaveFocus();
  await u.clear(qty); await u.type(qty, "3");
  expect(qty).toHaveValue(3);
  expect(screen.getAllByText("Rs. 810.00").length).toBeGreaterThan(0);          // 3 x 270
  await u.type(within(row).getByLabelText("Discount percent for Sugar"), "10");  // 10 %
  expect(screen.getAllByText("Rs. 729.00").length).toBeGreaterThan(0);
  await u.click(document.getElementById("cash").closest(".money").querySelector("input"));
  await u.type(document.getElementById("cash"), "1000");
  expect(screen.getAllByText("Rs. 271.00").length).toBe(2);                    // change
  await u.click(screen.getByText("Save sale"));
  await screen.findByText(/Sale saved/);
  const post = calls.find(c => c.method === "POST" && c.path === "/sales");
  expect(post.body.lines).toEqual([{ barcode: "8901234500004", qty: 3, price: 270, disc: 10 }]);
  expect(post.body.cash).toBe(1000);
  await waitFor(() => expect(screen.getByDisplayValue("SAL-00043")).toBeInTheDocument());
});

test("stock check blocks over-selling", async () => {
  const u = userEvent.setup(); await login(u);
  await u.type(screen.getByPlaceholderText(/Scan barcode/), "8901234500001{Enter}");
  const qty = await screen.findByLabelText("Quantity for Samba rice");
  await u.clear(qty); await u.type(qty, "500");
  await u.click(screen.getByText("Save sale"));
  await screen.findByText(/Not enough Samba rice in Main store/);
  expect(calls.some(c => c.method === "POST" && c.path === "/sales")).toBe(false);
});

test("every page renders without crashing", async () => {
  const u = userEvent.setup(); await login(u);
  const open = async (section, sub, expectText) => {
    const btns = screen.getAllByText(section).filter(e => e.closest("button.nav"));
    if (btns[0].closest(".grp") && !btns[0].closest(".grp").classList.contains("open")) await u.click(btns[0]);
    const grp = screen.getAllByText(section).find(e => e.closest("button.nav")).closest(".grp");
    await u.click(within(grp).getByText(sub, { selector: "button.subitem" }));
    await screen.findAllByText(expectText);
  };
  await open("Sales", "Sales history", "Sales bills");
  await open("Purchase", "New purchase", "Purchase entry");
  await open("Purchase", "Purchase history", "Purchase bills");
  await open("Purchase", "Suppliers", "Supplier list");
  await open("Products", "All products", "Product list");
  await open("Products", "Add product", "Product details");
  await open("Products", "Modify product", "Choose a product");
  await open("Products", "Groups", "Add a group");
  await open("Warehouse", "Stock overview", "Warehouse");
  await open("Warehouse", "Low stock", /need attention/);
  await open("Warehouse", "Stock transfer", "New transfer");
  await open("Staff access", "Team & permissions", "Team (1)");
  await open("Staff access", "Add staff", "Staff details");
  await open("Staff access", "Admin settings", "Change admin password");
  await open("Notifications", "Stock alerts", "Total alerts");
  await open("Reports", "Summary", "Recent transactions");
  await open("Reports", "Sales report", "By customer");
  await open("Reports", "Purchase report", "By supplier");
  await open("Reports", "Stock report", "Stock by warehouse");
});

test("restock from Low stock fills the purchase bill", async () => {
  const u = userEvent.setup(); await login(u);
  const warehouse = screen.getAllByText("Warehouse").find(e => e.closest("button.nav"));
  await u.click(warehouse);
  await u.click(screen.getByText("Low stock", { selector: "button.subitem" }));
  await u.click(await screen.findByText("Restock"));
  await screen.findByText("Purchase entry");
  expect(screen.getByLabelText("Quantity for Samba rice")).toHaveValue(50);
  expect(screen.getByLabelText("Receiving warehouse")).toHaveValue("Branch store");
});

test("staff without Staff access never sees it", async () => {
  global.fetch.mockImplementationOnce(() => ok(["Nimali"]));
  const u = userEvent.setup();
  render(<Root />);
  await screen.findByPlaceholderText("Enter password");
  expect(screen.queryByText("Staff access")).toBeNull();
});

test("Modify product saves changed name and prices", async () => {
  const u = userEvent.setup(); await login(u);
  await u.click(screen.getAllByText("Products").find(e => e.closest("button.nav")));
  await u.click(screen.getByText("Modify product", { selector: "button.subitem" }));
  await u.click(await screen.findByRole("option", { name: /Sugar/ }));
  const name = await screen.findByLabelText("Product name");
  expect(name).toHaveValue("Sugar");
  expect(screen.getByLabelText(/Barcode/)).toHaveAttribute("readonly");
  await u.clear(name); await u.type(name, "White sugar");
  const mrp = screen.getByLabelText(/Selling price/);
  await u.clear(mrp); await u.type(mrp, "280");
  await u.click(screen.getByText("Save changes"));
  await screen.findByText(/White sugar updated/);
  const patch = calls.find(c => c.method === "PATCH" && c.path === "/products/8901234500004");
  expect(patch.body).toMatchObject({ name: "White sugar", mrp: 280, buy: 235, unit: "kg", group: "Grocery" });
});

test("Edit button on the product list opens Modify with that product", async () => {
  const u = userEvent.setup(); await login(u);
  await u.click(screen.getAllByText("Products").find(e => e.closest("button.nav")));
  await u.click(screen.getByText("All products", { selector: "button.subitem" }));
  await u.click(await screen.findByLabelText("Edit Samba rice"));
  expect(await screen.findByLabelText("Product name")).toHaveValue("Samba rice");
});

test("notifications list products under 10 units, per warehouse", async () => {
  db.stock["Branch store"]["8901234500001"] = 4;    // Samba rice, Branch store -> alert
  db.stock["Main store"]["8901234500004"] = 0;      // Sugar, Main store -> out of stock
  const u = userEvent.setup(); await login(u);
  await screen.findByText(/2 stock alerts/);                           // toast after sign in
  await u.click(screen.getAllByText("Notifications").find(e => e.closest("button.nav")));
  expect(await screen.findByText("is out of stock")).toBeInTheDocument();
  expect(screen.getByText(/has only 4 kg left/)).toBeInTheDocument();
  expect(screen.getAllByText(/Branch store · stock product/).length).toBe(1);
  await u.click(screen.getByText(/Main store \(1\)/));
  expect(screen.queryByText(/has only 4 kg left/)).toBeNull();
  // the Products page shows the same alert
  await u.click(screen.getAllByText("Products").find(e => e.closest("button.nav")));
  await u.click(screen.getByText("All products", { selector: "button.subitem" }));
  expect((await screen.findAllByText(/Low in 1/)).length).toBe(2);
});

test("reports summary draws the sales and purchases line graph", async () => {
  const u = userEvent.setup(); await login(u);
  await u.click(screen.getAllByText("Reports").find(e => e.closest("button.nav")));
  await u.click(screen.getByText("Summary", { selector: "button.subitem" }));
  const chart = await screen.findByRole("img", { name: /Line graph of Sales and Purchases/ });
  expect(chart.querySelectorAll("path.lc-line").length).toBe(2);
  await u.click(screen.getByText("90 days"));
  await waitFor(() => expect(calls.some(c => c.path === "/reports/trend?days=90")).toBe(true));
});

test("sidebar can be collapsed, resized by preset and reset", async () => {
  const u = userEvent.setup(); await login(u);
  const nav = screen.getByRole("navigation", { name: "Main menu" });
  await u.click(screen.getByTitle("Customize menu bar"));
  await u.click(screen.getByText("Wide"));
  expect(nav.style.getPropertyValue("--sidebar-width")).toBe("290px");
  await u.click(screen.getByTitle("Collapse menu bar"));
  expect(nav).toHaveClass("collapsed");
  expect(nav.style.getPropertyValue("--sidebar-width")).toBe("76px");
  await u.click(screen.getByText("Reset to default"));
  expect(nav).not.toHaveClass("collapsed");
  expect(nav.style.getPropertyValue("--sidebar-width")).toBe("224px");
});
