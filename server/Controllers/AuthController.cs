using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/auth")]
public class AuthController(MongoDb db, JwtService jwt, SettingsService settings) : ApiBase
{
    // Names for the staff drop-down on the login screen (names only, nothing sensitive)
    [HttpGet("staff-names")]
    public async Task<IActionResult> StaffNames()
        => Ok(await db.Staffs.Find(Builders<StaffMember>.Filter.Empty).SortBy(s => s.Id).Project(s => s.Name).ToListAsync());

    [HttpPost("login"), EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest b)
    {
        if (b.Mode == "admin")
        {
            var s = await settings.GetAsync();
            if (string.IsNullOrEmpty(b.Password) || !BCrypt.Net.BCrypt.Verify(b.Password, s.AdminPasswordHash))
                throw new HttpError(401, "Wrong admin password");
            var token = jwt.Sign(new Dictionary<string, object> { ["type"] = "admin", ["name"] = s.AdminName });
            return Ok(new { token, user = new UserDto("admin", s.AdminName, "Admin", Perms.All()) });
        }

        var name = Util.Clean(b.Name);
        var st = await db.Staffs.Find(x => x.Name == name).FirstOrDefaultAsync();
        if (st == null) throw new HttpError(401, "Choose a staff member");
        if (string.IsNullOrEmpty(b.Pin) || !BCrypt.Net.BCrypt.Verify(b.Pin, st.PinHash)) throw new HttpError(401, "Wrong PIN");
        var staffToken = jwt.Sign(new Dictionary<string, object> { ["type"] = "staff", ["sub"] = st.Id, ["name"] = st.Name });
        return Ok(new { token = staffToken, user = new UserDto("staff", st.Name, st.Role, st.Perms) });
    }

    [HttpGet("me"), StockAuth]
    public IActionResult MeInfo()
        => Ok(new UserDto(Me.Type, Me.Name, Me.Role, Me.Type == "admin" ? Perms.All() : Me.Perms));
}
