using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using MongoDB.Bson.Serialization.Conventions;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ---- Settings (appsettings.json, or environment variables like StockPilot__JwtSecret) ----
var opts = builder.Configuration.GetSection("StockPilot").Get<StockPilotOptions>() ?? new StockPilotOptions();
if (builder.Environment.IsProduction() && opts.JwtSecret == StockPilotOptions.DevSecret && !args.Contains("--seed"))
{
    Console.Error.WriteLine("Set a real StockPilot__JwtSecret (environment variable) before running in production.");
    Environment.Exit(1);
}

// ---- MongoDB: camelCase field names (as Mongoose stored them) and ignore fields like __v ----
ConventionRegistry.Register("StockPilot", new ConventionPack
{
    new CamelCaseElementNameConvention(),
    new IgnoreExtraElementsConvention(true)
}, _ => true);

// ---- Services ----
builder.Services.AddSingleton(opts);
builder.Services.AddSingleton<MongoDb>();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<CounterService>();
builder.Services.AddSingleton<StockService>();
builder.Services.AddSingleton<Bootstrapper>();
builder.Services.AddSingleton<Seeder>();

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    })
    .ConfigureApiBehaviorOptions(o =>
        o.InvalidModelStateResponseFactory = _ => new BadRequestObjectResult(new { error = "Invalid request data" }));

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(opts.ClientOrigin).AllowAnyHeader().AllowAnyMethod()));

// 30 login attempts per IP per 15 minutes (same as express-rate-limit before)
builder.Services.AddRateLimiter(o =>
{
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));
    o.OnRejected = async (c, ct) =>
    {
        c.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await c.HttpContext.Response.WriteAsJsonAsync(new { error = "Too many login attempts, try again in a few minutes" }, ct);
    };
});

builder.WebHost.ConfigureKestrel(o => o.AddServerHeader = false);

var app = builder.Build();

// ---- Start-up: connect, create indexes + defaults (or load sample data with --seed) ----
try
{
    if (args.Contains("--seed"))
    {
        await app.Services.GetRequiredService<Seeder>().RunAsync();
        return;
    }
    await app.Services.GetRequiredService<Bootstrapper>().InitAsync();
}
catch (Exception e)
{
    Console.Error.WriteLine("Could not start: " + e.Message);
    Environment.Exit(1);
}

// ---- Pipeline ----
app.UseMiddleware<ErrorMiddleware>();
app.Use(async (ctx, next) =>   // a few of the headers helmet used to add
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

// In production, serve the built React app from the same server (published wwwroot, or ../client/dist)
var dist = new[] { Path.Combine(app.Environment.ContentRootPath, "wwwroot"), Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "client", "dist")) }
    .FirstOrDefault(d => File.Exists(Path.Combine(d, "index.html")));
StaticFileOptions spaOptions = null;
if (dist != null)
{
    var files = new PhysicalFileProvider(dist);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
    spaOptions = new StaticFileOptions { FileProvider = files };
    app.UseStaticFiles(spaOptions);
}

app.UseRouting();
app.UseCors();
app.UseRateLimiter();

app.MapGet("/api/health", () => new { ok = true });
app.MapControllers();
app.MapMethods("/api/{**path}", new[] { "GET", "POST", "PUT", "PATCH", "DELETE" }, () => Results.Json(new { error = "Not found" }, statusCode: 404));
if (spaOptions != null) app.MapFallbackToFile("index.html", spaOptions);

app.Run();
