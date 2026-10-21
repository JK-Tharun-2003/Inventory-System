using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/products"), StockAuth]
public class ProductsController(MongoDb db) : ApiBase
{
    [HttpPost, StockAuth("products")]
    public async Task<IActionResult> Create([FromBody] ProductCreate b)
    {
        var barcode = Util.Clean(b.Barcode);
        var name = Util.Clean(b.Name);
        var unit = Util.Clean(b.Unit);
        if (unit == "") unit = "kg";
        var group = Util.Clean(b.Group);

        if (barcode == "" || name == "" || b.Buy == null || b.Mrp == null || b.Buy < 0 || b.Mrp < 0)
            throw new HttpError(400, "Fill barcode, name and both prices");
        if (group == "") throw new HttpError(400, "Create a product group first");
        if (!await db.Groups.Find(g => g.Name == group).AnyAsync()) throw new HttpError(400, "That group does not exist");
        if (await db.Products.Find(p => p.Barcode == barcode).AnyAsync()) throw new HttpError(409, "That barcode already exists");

        var product = new Product { Barcode = barcode, Name = name, Unit = unit, Group = group, Buy = b.Buy.Value, Mrp = b.Mrp.Value };
        await db.Products.InsertOneAsync(product);
        return StatusCode(201, product);
    }

    // Modify a product: name, group, unit and both prices (the barcode is the product's identity, so it stays fixed)
    [HttpPatch("{barcode}"), StockAuth("products")]
    public async Task<IActionResult> Update(string barcode, [FromBody] ProductPatch b)
    {
        var p = await db.Products.Find(x => x.Barcode == barcode).FirstOrDefaultAsync();
        if (p == null) throw new HttpError(404, "Product not found");

        if (b.Name != null)
        {
            var n = Util.Clean(b.Name);
            if (n == "") throw new HttpError(400, "Product name cannot be empty");
            p.Name = n;
        }
        if (b.Group != null)
        {
            var g = Util.Clean(b.Group);
            if (!await db.Groups.Find(x => x.Name == g).AnyAsync()) throw new HttpError(400, "That group does not exist");
            p.Group = g;
        }
        if (b.Unit != null)
        {
            var u = Util.Clean(b.Unit);
            if (u != "") p.Unit = u;
        }
        if (b.Buy != null) { if (b.Buy < 0) throw new HttpError(400, "Prices must be zero or more"); p.Buy = b.Buy.Value; }
        if (b.Mrp != null) { if (b.Mrp < 0) throw new HttpError(400, "Prices must be zero or more"); p.Mrp = b.Mrp.Value; }

        await db.Products.ReplaceOneAsync(x => x.Id == p.Id, p);
        return Ok(p);
    }

    [HttpDelete("{barcode}"), StockAuth(AdminOnly = true)]
    public async Task<IActionResult> Delete(string barcode)
    {
        var r = await db.Products.DeleteOneAsync(p => p.Barcode == barcode);
        if (r.DeletedCount == 0) throw new HttpError(404, "Product not found");
        await db.Stocks.DeleteManyAsync(s => s.Barcode == barcode);
        return Ok(new { ok = true });
    }
}
