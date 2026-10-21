using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/groups"), StockAuth]
public class GroupsController(MongoDb db) : ApiBase
{
    private async Task<bool> ExistsAsync(string name, string exceptName = null)
    {
        var all = await db.Groups.Find(Builders<ProductGroup>.Filter.Empty).Project(g => g.Name).ToListAsync();
        return all.Any(n => n != exceptName && string.Equals(n, name, StringComparison.OrdinalIgnoreCase));
    }

    [HttpPost, StockAuth("products")]
    public async Task<IActionResult> Create([FromBody] GroupBody b)
    {
        var name = Util.Clean(b.Name);
        if (name == "") throw new HttpError(400, "Type a group name");
        if (await ExistsAsync(name)) throw new HttpError(409, "That group already exists");
        await db.Groups.InsertOneAsync(new ProductGroup { Name = name });
        return StatusCode(201, new { name });
    }

    // Rename - products in the group follow the new name
    [HttpPatch("{name}"), StockAuth("products")]
    public async Task<IActionResult> Rename(string name, [FromBody] GroupBody b)
    {
        var old = name;
        var newName = Util.Clean(b.Name);
        if (newName == "") throw new HttpError(400, "Group name cannot be empty");
        var g = await db.Groups.Find(x => x.Name == old).FirstOrDefaultAsync();
        if (g == null) throw new HttpError(404, "Group not found");
        if (await ExistsAsync(newName, old)) throw new HttpError(409, "That group already exists");
        await db.Groups.UpdateOneAsync(x => x.Id == g.Id, Builders<ProductGroup>.Update.Set(x => x.Name, newName));
        await db.Products.UpdateManyAsync(p => p.Group == old, Builders<Product>.Update.Set(p => p.Group, newName));
        return Ok(new { name = newName });
    }

    [HttpDelete("{name}"), StockAuth(AdminOnly = true)]
    public async Task<IActionResult> Delete(string name)
    {
        var n = await db.Products.CountDocumentsAsync(p => p.Group == name);
        if (n > 0) throw new HttpError(400, $"Move the {n} product{(n == 1 ? "" : "s")} out of \"{name}\" first");
        await db.Groups.DeleteOneAsync(g => g.Name == name);
        return Ok(new { ok = true });
    }
}
