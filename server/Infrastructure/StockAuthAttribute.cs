using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using StockPilot.Api.Services;

namespace StockPilot.Api.Infrastructure;

/// <summary>
/// Replaces the Node `auth`, `requirePerm(...)` and `requireAdmin` middleware.
///   [StockAuth]                    signed in
///   [StockAuth("sales")]           signed in + needs the "sales" permission
///   [StockAuth(AdminOnly = true)]  admin only
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class StockAuthAttribute : Attribute, IAsyncAuthorizationFilter
{
    public const string ItemKey = "sp-user";

    public string Perm { get; set; }
    public bool AdminOnly { get; set; }

    public StockAuthAttribute() { }
    public StockAuthAttribute(string perm) { Perm = perm; }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var http = context.HttpContext;
        var user = http.Items[ItemKey] as AuthUser;
        if (user == null)
        {
            var auth = http.RequestServices.GetRequiredService<AuthService>();
            user = await auth.AuthenticateAsync(http.Request.Headers.Authorization.ToString());
            http.Items[ItemKey] = user;
        }
        if (AdminOnly && user.Type != "admin") throw new HttpError(403, "Only the admin can do this");
        if (Perm != null && !AuthService.Can(user, Perm)) throw new HttpError(403, $"You don't have access to {Perm}");
    }
}

[ApiController]
public abstract class ApiBase : ControllerBase
{
    protected AuthUser Me => (AuthUser)HttpContext.Items[StockAuthAttribute.ItemKey];
}
