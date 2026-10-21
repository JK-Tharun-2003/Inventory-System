using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/reports"), StockAuth("reports")]
public class ReportsController(MongoDb db, StockService stockSvc, StockPilotOptions opts) : ApiBase
{
    public class RecentRow
    {
        public string No { get; set; }
        public string Party { get; set; }
        public long Ts { get; set; }
        public string Status { get; set; }
        public double Total { get; set; }
        public string T { get; set; }
    }

    public class TrendDay
    {
        public string Date { get; set; }
        public double Sales { get; set; }
        public double Purchases { get; set; }
        public int Bills { get; set; }
    }

    private async Task<(List<Product> products, List<string> warehouses, Dictionary<string, Dictionary<string, double>> stock)> StockBaseAsync()
    {
        var products = await db.Products.Find(Builders<Product>.Filter.Empty).SortBy(p => p.Id).ToListAsync();
        var warehouses = await db.Warehouses.Find(Builders<Warehouse>.Filter.Empty).SortBy(w => w.Id).Project(w => w.Name).ToListAsync();
        return (products, warehouses, await stockSvc.StockMapAsync(warehouses));
    }

    private static double Q(Dictionary<string, Dictionary<string, double>> stock, string w, string barcode)
        => stock.TryGetValue(w, out var m) && m.TryGetValue(barcode, out var q) ? q : 0;

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var (products, warehouses, stock) = await StockBaseAsync();

        var stockValue = products.Sum(p => warehouses.Sum(w => Q(stock, w, p.Barcode)) * p.Buy);
        var low = new List<object>();
        foreach (var w in warehouses)
            foreach (var p in products)
            {
                var n = Q(stock, w, p.Barcode);
                if (n < opts.LowStock) low.Add(new { w, name = p.Name, unit = p.Unit, q = n });
            }

        var sales = await db.Sales.Find(Builders<Sale>.Filter.Empty).SortByDescending(s => s.Ts).Limit(10)
            .Project(s => new RecentRow { No = s.No, Party = s.Party, Ts = s.Ts, Status = s.Status, Total = s.Total, T = "Sale" }).ToListAsync();
        var purchases = await db.Purchases.Find(Builders<Purchase>.Filter.Empty).SortByDescending(p => p.Ts).Limit(10)
            .Project(p => new RecentRow { No = p.No, Party = p.Party, Ts = p.Ts, Status = p.Status, Total = p.Total, T = "Purchase" }).ToListAsync();
        var recent = sales.Concat(purchases).OrderByDescending(r => r.Ts).Take(10).ToList();

        var totalSales = (await db.Sales.Find(Builders<Sale>.Filter.Empty).Project(s => s.Total).ToListAsync()).Sum();
        var totalPurchases = (await db.Purchases.Find(Builders<Purchase>.Filter.Empty).Project(p => p.Total).ToListAsync()).Sum();

        return Ok(new { totalSales, totalPurchases, stockValue, low, recent });
    }

    // Daily sales and purchases for the line graphs: GET /api/reports/trend?days=30
    [HttpGet("trend")]
    public async Task<IActionResult> Trend([FromQuery] int? days)
    {
        var n = Math.Clamp(days is null or 0 ? 30 : days.Value, 1, 365);
        var start = DateTime.Today.AddDays(-(n - 1));
        var startMs = new DateTimeOffset(start).ToUnixTimeMilliseconds();
        string Key(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        string KeyOf(long ts) => Key(DateTimeOffset.FromUnixTimeMilliseconds(ts).ToLocalTime().DateTime);

        var rows = new List<TrendDay>();
        var buckets = new Dictionary<string, TrendDay>();
        for (var i = 0; i < n; i++)
        {
            var row = new TrendDay { Date = Key(start.AddDays(i)) };
            rows.Add(row);
            buckets[row.Date] = row;
        }

        var sales = await db.Sales.Find(s => s.Ts >= startMs).Project(s => new { s.Ts, s.Total }).ToListAsync();
        var purchases = await db.Purchases.Find(p => p.Ts >= startMs).Project(p => new { p.Ts, p.Total }).ToListAsync();
        foreach (var x in sales) if (buckets.TryGetValue(KeyOf(x.Ts), out var b)) { b.Sales += x.Total; b.Bills++; }
        foreach (var x in purchases) if (buckets.TryGetValue(KeyOf(x.Ts), out var b)) b.Purchases += x.Total;
        foreach (var r in rows) { r.Sales = Util.Round2(r.Sales); r.Purchases = Util.Round2(r.Purchases); }

        return Ok(new { days = rows, totals = new { sales = rows.Sum(r => r.Sales), purchases = rows.Sum(r => r.Purchases) } });
    }

    // kind = sales | purchases  ->  grouped by customer / supplier
    [HttpGet("party/{kind}")]
    public async Task<IActionResult> Party(string kind)
    {
        var raw = kind == "purchases"
            ? (await db.Purchases.Find(Builders<Purchase>.Filter.Empty).Project(p => new { p.Party, p.Units, p.Total }).ToListAsync())
                .Select(p => (p.Party, p.Units, p.Total)).ToList()
            : (await db.Sales.Find(Builders<Sale>.Filter.Empty).Project(s => new { s.Party, s.Units, s.Total }).ToListAsync())
                .Select(s => (s.Party, s.Units, s.Total)).ToList();

        var rows = raw.GroupBy(r => r.Party)
            .Select(g => new { name = g.Key, n = g.Count(), u = g.Sum(x => x.Units), t = g.Sum(x => x.Total) })
            .OrderByDescending(r => r.t).ToList();

        return Ok(new { rows, total = rows.Sum(r => r.t), bills = rows.Sum(r => r.n), units = rows.Sum(r => r.u) });
    }

    [HttpGet("stock")]
    public async Task<IActionResult> StockReport()
    {
        var (products, warehouses, stock) = await StockBaseAsync();
        var rows = products.Select(p =>
        {
            var qs = warehouses.Select(w => Q(stock, w, p.Barcode)).ToList();
            var q = qs.Sum();
            return new { name = p.Name, qs, q, value = q * p.Buy };
        }).ToList();

        return Ok(new
        {
            warehouses,
            rows,
            lowStock = opts.LowStock,
            totals = new
            {
                perWarehouse = warehouses.Select((w, i) => rows.Sum(r => r.qs[i])).ToList(),
                q = rows.Sum(r => r.q),
                value = rows.Sum(r => r.value)
            },
            products = products.Count
        });
    }
}
