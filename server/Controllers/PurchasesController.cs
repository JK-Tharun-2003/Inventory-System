using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/purchases"), StockAuth("purchase")]
public class PurchasesController(MongoDb db, StockService stock, CounterService counters) : ApiBase
{
    private static readonly string[] Statuses = { "Paid", "Pending", "Partial" };

    [HttpGet]
    public async Task<IActionResult> List()
        => Ok(await db.Purchases.Find(Builders<Purchase>.Filter.Empty).SortByDescending(p => p.Ts).ToListAsync());

    // Supplier list = purchases grouped by supplier
    [HttpGet("suppliers")]
    public async Task<IActionResult> Suppliers()
    {
        var rows = await db.Purchases.Find(Builders<Purchase>.Filter.Empty)
            .Project(p => new { p.Party, p.Units, p.Total, p.Status, p.Ts }).ToListAsync();
        var result = rows.GroupBy(r => r.Party)
            .Select(g => new
            {
                name = g.Key,
                n = g.Count(),
                u = g.Sum(x => x.Units),
                t = g.Sum(x => x.Total),
                due = g.Where(x => x.Status != "Paid").Sum(x => x.Total),
                last = g.Max(x => x.Ts)
            })
            .OrderByDescending(x => x.t)
            .ToList();
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PurchaseRequest b)
    {
        var wh = Util.Clean(b.Wh);
        var status = Statuses.Contains(b.Status) ? b.Status : "Paid";
        if (!await db.Warehouses.Find(w => w.Name == wh).AnyAsync()) throw new HttpError(400, "Choose a receiving warehouse");
        if (b.Lines == null || b.Lines.Count == 0) throw new HttpError(400, "Add at least one item first");

        var barcodes = b.Lines.Select(l => l?.Barcode ?? "").ToList();
        var products = (await db.Products.Find(p => barcodes.Contains(p.Barcode)).ToListAsync()).ToDictionary(p => p.Barcode);

        var lines = new List<PurchaseLine>();
        foreach (var l in b.Lines)
        {
            if (l == null || !products.TryGetValue(l.Barcode ?? "", out var p)) throw new HttpError(400, $"Unknown product {l?.Barcode}");
            if (!(l.Qty > 0)) throw new HttpError(400, "Quantity must be at least 1");
            if (l.Buy == null || l.Mrp == null || l.Buy < 0 || l.Mrp < 0) throw new HttpError(400, "Prices must be zero or more");
            lines.Add(new PurchaseLine
            {
                Barcode = p.Barcode, Name = p.Name, Unit = p.Unit,
                Qty = l.Qty.Value, Buy = l.Buy.Value, Mrp = l.Mrp.Value,
                Total = Util.Round2(l.Qty.Value * l.Buy.Value)
            });
        }
        var total = Util.Round2(lines.Sum(l => l.Total));
        var units = lines.Sum(l => l.Qty);

        await stock.ApplyDeltasAsync(lines.Select(l => new StockDelta(wh, l.Barcode, l.Qty)));

        Purchase rec;
        try
        {
            // Latest purchase price / selling price update the product, like the prototype
            var updates = lines.Select(l => (WriteModel<Product>)new UpdateOneModel<Product>(
                Builders<Product>.Filter.Eq(p => p.Barcode, l.Barcode),
                Builders<Product>.Update.Set(p => p.Buy, l.Buy).Set(p => p.Mrp, l.Mrp))).ToList();
            await db.Products.BulkWriteAsync(updates);

            var vendor = Util.Clean(b.Vendor);
            var method = Util.Clean(b.Method);
            rec = new Purchase
            {
                No = Util.NumFmt("PUR", await counters.NextAsync("purchase")),
                Party = vendor == "" ? "—" : vendor,
                Bill = Util.Clean(b.Bill),
                Wh = wh,
                Method = method == "" ? "Cash" : method,
                Status = status,
                Total = total,
                Units = units,
                Ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                By = Me.Name,
                Lines = lines
            };
            await db.Purchases.InsertOneAsync(rec);
        }
        catch
        {   // bill failed to save: take the stock back out
            try { await stock.ApplyDeltasAsync(lines.Select(l => new StockDelta(wh, l.Barcode, -l.Qty))); } catch { }
            throw;
        }
        return StatusCode(201, rec);
    }
}
