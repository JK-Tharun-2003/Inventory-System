using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/transfers"), StockAuth("warehouse")]
public class TransfersController(MongoDb db, StockService stock) : ApiBase
{
    [HttpGet]
    public async Task<IActionResult> Recent()
        => Ok(await db.Transfers.Find(Builders<Transfer>.Filter.Empty).SortByDescending(t => t.Ts).Limit(8).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TransferRequest b)
    {
        var from = Util.Clean(b.From);
        var to = Util.Clean(b.To);
        var barcode = Util.Clean(b.Barcode);
        if (from == to) throw new HttpError(400, "Choose two different warehouses");
        if (!(b.Qty > 0)) throw new HttpError(400, "Enter a quantity");
        var qty = b.Qty.Value;

        var fromOk = await db.Warehouses.Find(w => w.Name == from).AnyAsync();
        var toOk = await db.Warehouses.Find(w => w.Name == to).AnyAsync();
        var p = await db.Products.Find(x => x.Barcode == barcode).FirstOrDefaultAsync();
        if (!fromOk || !toOk) throw new HttpError(400, "Unknown warehouse");
        if (p == null) throw new HttpError(400, "Unknown product");

        var row = await db.Stocks.Find(s => s.Warehouse == from && s.Barcode == p.Barcode).FirstOrDefaultAsync();
        var have = row?.Qty ?? 0;
        if (qty > have) throw new HttpError(400, $"Only {Util.Num(have)} {p.Unit} available in {from}");

        await stock.ApplyDeltasAsync(new[]
        {
            new StockDelta(from, p.Barcode, -qty, p.Name),
            new StockDelta(to, p.Barcode, qty)
        });

        var t = new Transfer { Ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), From = from, To = to, Barcode = p.Barcode, Name = p.Name, Qty = qty, By = Me.Name };
        await db.Transfers.InsertOneAsync(t);
        return StatusCode(201, new { ts = t.Ts, from, to, name = p.Name, qty, unit = p.Unit });
    }
}
