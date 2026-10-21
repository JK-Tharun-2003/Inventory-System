using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/sales"), StockAuth("sales")]
public class SalesController(MongoDb db, StockService stock, CounterService counters) : ApiBase
{
    private static readonly string[] Statuses = { "Paid", "Pending", "Partial" };

    [HttpGet]
    public async Task<IActionResult> List()
        => Ok(await db.Sales.Find(Builders<Sale>.Filter.Empty).SortByDescending(s => s.Ts).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaleRequest b)
    {
        var wh = Util.Clean(b.Wh);
        var status = Statuses.Contains(b.Status) ? b.Status : "Paid";
        var method = Util.Clean(b.Method);
        if (method == "") method = "Cash";
        if (!await db.Warehouses.Find(w => w.Name == wh).AnyAsync()) throw new HttpError(400, "Choose the warehouse you are selling from");
        if (b.Lines == null || b.Lines.Count == 0) throw new HttpError(400, "Add at least one item first");

        var barcodes = b.Lines.Select(l => l?.Barcode ?? "").ToList();
        var products = (await db.Products.Find(p => barcodes.Contains(p.Barcode)).ToListAsync()).ToDictionary(p => p.Barcode);

        var lines = new List<SaleLine>();
        foreach (var l in b.Lines)
        {
            if (l == null || !products.TryGetValue(l.Barcode ?? "", out var p)) throw new HttpError(400, $"Unknown product {l?.Barcode}");
            if (!(l.Qty > 0)) throw new HttpError(400, "Quantity must be at least 1");
            var price = l.Price ?? p.Mrp;
            var disc = l.Disc ?? 0;
            if (price < 0 || disc < 0 || disc > 100) throw new HttpError(400, "Check the price and discount");
            lines.Add(new SaleLine
            {
                Barcode = p.Barcode, Name = p.Name, Unit = p.Unit,
                Qty = l.Qty.Value, Price = price, Disc = disc, Mrp = p.Mrp,
                Total = l.Qty.Value * price * (1 - disc / 100)
            });
        }
        var total = Util.Round2(lines.Sum(l => l.Total));
        var units = lines.Sum(l => l.Qty);
        foreach (var l in lines) l.Total = Util.Round2(l.Total);

        // Cash handling - same rules as the prototype
        var received = status == "Pending" ? 0 : total;
        var change = 0.0;
        if (method == "Cash" && status != "Pending" && b.Cash != null)
        {
            var cash = b.Cash.Value;
            if (status == "Paid" && cash < total - 0.005)
                throw new HttpError(400, $"Cash received is Rs. {Util.Round2(total - cash).ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} short. Enter the full amount or set status to Partial");
            received = Math.Min(cash, total);
            change = Util.Round2(Math.Max(0, cash - total));
        }

        await stock.ApplyDeltasAsync(lines.Select(l => new StockDelta(wh, l.Barcode, -l.Qty, l.Name)));

        Sale rec;
        try
        {
            var customer = Util.Clean(b.Customer);
            rec = new Sale
            {
                No = Util.NumFmt("SAL", await counters.NextAsync("sale")),
                Party = customer == "" ? "Walk-in customer" : customer,
                Wh = wh, Method = method, Status = status,
                Total = total, Units = units,
                Received = Util.Round2(received), Change = change,
                Ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                By = Me.Name, Lines = lines
            };
            await db.Sales.InsertOneAsync(rec);
        }
        catch
        {   // bill failed to save: put the stock back
            try { await stock.ApplyDeltasAsync(lines.Select(l => new StockDelta(wh, l.Barcode, l.Qty))); } catch { }
            throw;
        }
        return StatusCode(201, rec);
    }
}
