using Microsoft.AspNetCore.Mvc;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;
using StockPilot.Api.Services;

namespace StockPilot.Api.Controllers;

[Route("api/settings"), StockAuth(AdminOnly = true)]
public class SettingsController(SettingsService settings) : ApiBase
{
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] PasswordChange b)
    {
        var s = await settings.GetAsync();
        if (string.IsNullOrEmpty(b.Current) || !BCrypt.Net.BCrypt.Verify(b.Current, s.AdminPasswordHash))
            throw new HttpError(400, "Current password is wrong");
        if ((b.Next ?? "").Length < 4) throw new HttpError(400, "New password must be at least 4 characters");
        s.AdminPasswordHash = BCrypt.Net.BCrypt.HashPassword(b.Next, 10);
        await settings.SaveAsync(s);
        return Ok(new { ok = true });
    }

    [HttpPut("shop")]
    public async Task<IActionResult> SaveShop([FromBody] ShopBody b)
    {
        var s = await settings.GetAsync();
        var name = Util.Clean(b.Name);
        s.ShopName = name == "" ? "Your Shop Name" : name;
        s.ShopLine = Util.Clean(b.Line);
        await settings.SaveAsync(s);
        return Ok(new { name = s.ShopName, line = s.ShopLine });
    }
}
