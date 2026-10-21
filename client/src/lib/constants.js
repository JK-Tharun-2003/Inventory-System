export const NAV = [
  { id: "sales", label: "Sales", subs: [["new", "New sale"], ["history", "Sales history"]] },
  { id: "purchase", label: "Purchase", subs: [["new", "New purchase"], ["history", "Purchase history"], ["suppliers", "Suppliers"]] },
  { id: "products", label: "Products", subs: [["all", "All products"], ["add", "Add product"], ["modify", "Modify product"], ["groups", "Groups"]] },
  { id: "warehouse", label: "Warehouse", subs: [["overview", "Stock overview"], ["low", "Low stock"], ["transfer", "Stock transfer"]] },
  { id: "notifications", label: "Notifications", subs: [["all", "Stock alerts"]] },
  { id: "staff", label: "Staff access", subs: [["team", "Team & permissions"], ["add", "Add staff"], ["settings", "Admin settings"]] },
  { id: "reports", label: "Reports", subs: [["summary", "Summary"], ["sales", "Sales report"], ["purchases", "Purchase report"], ["stock", "Stock report"]] }
];

export const UNITS = ["kg", "g", "L", "ml", "nos", "pack", "box", "dozen"];
export const SECTION_LABELS = { sales: "Sales", purchase: "Purchase", products: "Products", warehouse: "Warehouse", reports: "Reports" };
export const ROLE_PRESETS = {
  Cashier: { sales: 1 },
  "Store keeper": { purchase: 1, products: 1, warehouse: 1 },
  Accountant: { purchase: 1, reports: 1 },
  Manager: { sales: 1, purchase: 1, products: 1, warehouse: 1, reports: 1 }
};
export const SUGGESTED_GROUPS = ["Stationery", "Beverages", "Grocery", "Dairy", "Snacks", "Bakery", "Household", "Personal care", "Electronics", "Frozen foods", "Vegetables", "Fruits", "Medicine", "Toys", "Clothing"];
export const GCOL = [["#E2F4EB", "#116243"], ["#FDF0D8", "#7A4B00"], ["#E4ECFD", "#2A4FA8"], ["#F8E4F1", "#8A2A6B"], ["#FBE7E1", "#B4452F"], ["#E8E4FB", "#4B3AA8"], ["#DDF1F3", "#126A73"], ["#EFEFE2", "#5A5A22"]];
export const LOW = 20;
export const ALERT = 10; // under this many units in any warehouse = notification
