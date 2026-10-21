using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/bootstrap"), StockAuth]
public class BootstrapController(MongoDb db, SettingsService settings, CounterService counters, StockService stock, StockPilotOptions opts) : ApiBase
{
    // Everything the app needs on load: catalogue, groups, warehouses, live stock, shop details, next invoice numbers
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var products = await db.Products.Find(Builders<Product>.Filter.Empty).SortBy(p => p.Id).ToListAsync();
        var groups = await db.Groups.Find(Builders<ProductGroup>.Filter.Empty).SortBy(g => g.Id).Project(g => g.Name).ToListAsync();
        var warehouses = await db.Warehouses.Find(Builders<Warehouse>.Filter.Empty).SortBy(w => w.Id).Project(w => w.Name).ToListAsync();
        var s = await settings.GetAsync();
        var pur = await counters.PeekAsync("purchase");
        var sal = await counters.PeekAsync("sale");

        return Ok(new
        {
            products,
            groups,
            warehouses,
            stock = await stock.StockMapAsync(warehouses),
            shop = new { name = s.ShopName, line = s.ShopLine },
            next = new { purchase = pur + 1, sale = sal + 1 },
            lowStock = opts.LowStock,
            alertStock = opts.AlertStock
        });
    }
}
