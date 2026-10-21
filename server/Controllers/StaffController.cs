using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/staff"), StockAuth(AdminOnly = true)]   // staff can never open Staff access
public class StaffController(MongoDb db) : ApiBase
{
    private static object Shape(StaffMember s) => new { id = s.Id, name = s.Name, role = s.Role, perms = s.Perms };

    private static Perms PermsFrom(Dictionary<string, bool> d)
    {
        var p = new Perms();
        foreach (var k in Defaults.Sections) p.Set(k, d != null && d.TryGetValue(k, out var v) && v);
        return p;
    }

    private static void CheckPin(string pin)
    {
        if (pin.Length < 3 || pin.Length > 8) throw new HttpError(400, "PIN must be 3 to 8 characters");
    }

    [HttpGet]
    public async Task<IActionResult> List()
        => Ok((await db.Staffs.Find(Builders<StaffMember>.Filter.Empty).SortBy(s => s.Id).ToListAsync()).Select(Shape));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] StaffCreate b)
    {
        var name = Util.Clean(b.Name);
        var role = Util.Clean(b.Role);
        var pin = Util.Clean(b.Pin);
        if (name == "") throw new HttpError(400, "Enter a name");
        if (!Defaults.RolePresets.ContainsKey(role)) throw new HttpError(400, "Choose a role");
        CheckPin(pin);

        var names = await db.Staffs.Find(Builders<StaffMember>.Filter.Empty).Project(s => s.Name).ToListAsync();
        if (names.Any(n => string.Equals(n, name, StringComparison.OrdinalIgnoreCase)))
            throw new HttpError(409, "A staff member with that name already exists");

        var s = new StaffMember { Name = name, Role = role, PinHash = BCrypt.Net.BCrypt.HashPassword(pin, 10), Perms = PermsFrom(b.Perms) };
        await db.Staffs.InsertOneAsync(s);
        return StatusCode(201, Shape(s));
    }

    // Change role, page access switches or PIN
    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] StaffPatch b)
    {
        var s = ObjectId.TryParse(id, out _) ? await db.Staffs.Find(x => x.Id == id).FirstOrDefaultAsync() : null;
        if (s == null) throw new HttpError(404, "Staff member not found");

        if (b.Role != null)
        {
            if (!Defaults.RolePresets.ContainsKey(b.Role)) throw new HttpError(400, "Unknown role");
            s.Role = b.Role;
        }
        if (b.Perms != null)   // only the switches that were sent change
            foreach (var k in Defaults.Sections)
                if (b.Perms.TryGetValue(k, out var v)) s.Perms.Set(k, v ?? false);
        if (b.Pin != null)
        {
            var pin = Util.Clean(b.Pin);
            CheckPin(pin);
            s.PinHash = BCrypt.Net.BCrypt.HashPassword(pin, 10);
        }
        await db.Staffs.ReplaceOneAsync(x => x.Id == s.Id, s);
        return Ok(Shape(s));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        if (ObjectId.TryParse(id, out _)) await db.Staffs.DeleteOneAsync(s => s.Id == id);
        return Ok(new { ok = true });
    }
}
