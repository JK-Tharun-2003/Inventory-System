using MongoDB.Bson;
using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;

namespace StockPilot.Api.Services;

public class AuthUser
{
    public string Type { get; set; }   // "admin" | "staff"
    public string Id { get; set; }
    public string Name { get; set; }
    public string Role { get; set; }
    public Perms Perms { get; set; }
}

public class AuthService(MongoDb db, JwtService jwt)
{
    // Same rule as the prototype: admin can open everything, staff never open "staff", others need the switch on
    public static bool Can(AuthUser user, string section)
    {
        if (user == null) return false;
        if (user.Type == "admin") return true;
        if (section == "staff") return false;
        return user.Perms != null && user.Perms.Get(section);
    }

    public async Task<AuthUser> AuthenticateAsync(string authorizationHeader)
    {
        var h = authorizationHeader ?? "";
        var token = h.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? h[7..].Trim() : null;
        if (string.IsNullOrEmpty(token)) throw new HttpError(401, "Not signed in");

        var claims = await jwt.VerifyAsync(token);
        if (claims == null) throw new HttpError(401, "Session expired, please log in again");

        string Claim(string k) => claims.TryGetValue(k, out var v) ? v?.ToString() : null;

        if (Claim("type") == "admin")
            return new AuthUser { Type = "admin", Name = Claim("name"), Role = "Admin", Perms = Perms.All() };

        // Staff are re-read on every request so permission changes apply immediately
        var sub = Claim("sub");
        if (sub == null || !ObjectId.TryParse(sub, out _)) throw new HttpError(401, "This account no longer exists");
        var st = await db.Staffs.Find(s => s.Id == sub).FirstOrDefaultAsync();
        if (st == null) throw new HttpError(401, "This account no longer exists");
        return new AuthUser { Type = "staff", Id = st.Id, Name = st.Name, Role = st.Role, Perms = st.Perms ?? new Perms() };
    }
}
