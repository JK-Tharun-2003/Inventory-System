namespace StockPilot.Api.Infrastructure;

public class StockPilotOptions
{
    public const string DevSecret = "dev-secret-change-me";

    public string MongoDbUri { get; set; } = "mongodb://127.0.0.1:27017/stockpilot";
    public string JwtSecret { get; set; } = DevSecret;
    public int JwtExpiresHours { get; set; } = 12;
    public string ClientOrigin { get; set; } = "http://localhost:5173";
    public int LowStock { get; set; } = 20;     // items under this many units are "low stock"
    public int AlertStock { get; set; } = 10;   // items under this many units raise a notification
}

public static class Defaults
{
    public static readonly string[] Sections = { "sales", "purchase", "products", "warehouse", "reports" };

    public static readonly Dictionary<string, string[]> RolePresets = new()
    {
        ["Cashier"] = new[] { "sales" },
        ["Store keeper"] = new[] { "purchase", "products", "warehouse" },
        ["Accountant"] = new[] { "purchase", "reports" },
        ["Manager"] = new[] { "sales", "purchase", "products", "warehouse", "reports" }
    };

    public static readonly string[] Groups = { "Grocery", "Stationery", "Beverages", "Dairy", "Snacks", "Household", "Personal care" };
    public static readonly string[] Warehouses = { "Main store", "Branch store" };
}
