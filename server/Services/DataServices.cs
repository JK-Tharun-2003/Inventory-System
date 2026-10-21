using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;

namespace StockPilot.Api.Services;

public class SettingsService(MongoDb db)
{
    // Creates the admin login (password "admin123") the first time it is needed
    public async Task<Setting> GetAsync()
    {
        var s = await db.Settings.Find(x => x.Key == "main").FirstOrDefaultAsync();
        if (s == null)
        {
            s = new Setting { Key = "main", AdminPasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123", 10) };
            await db.Settings.InsertOneAsync(s);
        }
        return s;
    }

    public Task SaveAsync(Setting s) => db.Settings.ReplaceOneAsync(x => x.Id == s.Id, s);
}

public class CounterService(MongoDb db)
{
    public async Task<long> NextAsync(string name)
    {
        var doc = await db.Counters.FindOneAndUpdateAsync(
            Builders<Counter>.Filter.Eq(c => c.Id, name),
            Builders<Counter>.Update.Inc(c => c.Seq, 1L),
            new FindOneAndUpdateOptions<Counter> { IsUpsert = true, ReturnDocument = ReturnDocument.After });
        return doc.Seq;
    }

    public async Task<long> PeekAsync(string name)
    {
        var doc = await db.Counters.Find(c => c.Id == name).FirstOrDefaultAsync();
        return doc?.Seq ?? 0;
    }
}

public record StockDelta(string Warehouse, string Barcode, double Delta, string Label = null);

public class StockService(MongoDb db)
{
    /// <summary>{ "Main store": { "8901...": 120 }, ... } - same shape the prototype used</summary>
    public async Task<Dictionary<string, Dictionary<string, double>>> StockMapAsync(IEnumerable<string> warehouses)
    {
        var map = new Dictionary<string, Dictionary<string, double>>();
        foreach (var w in warehouses) map[w] = new Dictionary<string, double>();
        var rows = await db.Stocks.Find(Builders<StockItem>.Filter.Empty).ToListAsync();
        foreach (var r in rows)
        {
            if (!map.TryGetValue(r.Warehouse, out var m)) { m = new Dictionary<string, double>(); map[r.Warehouse] = m; }
            m[r.Barcode] = r.Qty;
        }
        return map;
    }

    /// <summary>
    /// Apply stock changes one by one. A decrease only succeeds if enough stock is there
    /// (atomic check inside MongoDB), and if any step fails everything already applied is undone.
    /// </summary>
    public async Task ApplyDeltasAsync(IEnumerable<StockDelta> deltas)
    {
        var f = Builders<StockItem>.Filter;
        var u = Builders<StockItem>.Update;
        var done = new List<StockDelta>();
        try
        {
            foreach (var d in deltas)
            {
                var match = f.And(f.Eq(s => s.Warehouse, d.Warehouse), f.Eq(s => s.Barcode, d.Barcode));
                if (d.Delta < 0)
                {
                    var r = await db.Stocks.UpdateOneAsync(f.And(match, f.Gte(s => s.Qty, -d.Delta)), u.Inc(s => s.Qty, d.Delta));
                    if (r.ModifiedCount == 0) throw new HttpError(400, $"Not enough {d.Label ?? d.Barcode} in {d.Warehouse}");
                }
                else
                {
                    await db.Stocks.UpdateOneAsync(match, u.Inc(s => s.Qty, d.Delta), new UpdateOptions { IsUpsert = true });
                }
                done.Add(d);
            }
        }
        catch
        {
            for (var i = done.Count - 1; i >= 0; i--)
            {
                var d = done[i];
                try
                {
                    var match = f.And(f.Eq(s => s.Warehouse, d.Warehouse), f.Eq(s => s.Barcode, d.Barcode));
                    await db.Stocks.UpdateOneAsync(match, u.Inc(s => s.Qty, -d.Delta), new UpdateOptions { IsUpsert = true });
                }
                catch { /* best effort, like the Node version */ }
            }
            throw;
        }
    }
}
