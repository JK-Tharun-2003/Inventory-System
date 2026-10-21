using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using StockPilot.Api.Infrastructure;

namespace StockPilot.Api.Services;

public class JwtService(StockPilotOptions opts)
{
    private readonly SymmetricSecurityKey _key = new(Encoding.UTF8.GetBytes(opts.JwtSecret));
    private readonly JsonWebTokenHandler _handler = new();

    public string Sign(Dictionary<string, object> claims)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Claims = claims,
            Expires = DateTime.UtcNow.AddHours(opts.JwtExpiresHours),
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256)
        };
        return _handler.CreateToken(descriptor);
    }

    /// <summary>Returns the token's claims, or null if it is invalid / expired.</summary>
    public async Task<IDictionary<string, object>> VerifyAsync(string token)
    {
        var result = await _handler.ValidateTokenAsync(token, new TokenValidationParameters
        {
            IssuerSigningKey = _key,
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(5)
        });
        return result.IsValid ? result.Claims : null;
    }
}
