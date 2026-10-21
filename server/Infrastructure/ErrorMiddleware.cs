using MongoDB.Driver;

namespace StockPilot.Api.Infrastructure;

// Turns every error into the same { "error": "..." } JSON the React client already understands
public class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> log)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try { await next(ctx); }
        catch (HttpError e) { await Write(ctx, e.Status, e.Message); }
        catch (MongoWriteException e) when (e.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        { await Write(ctx, 409, "That value already exists"); }
        catch (BadHttpRequestException) { await Write(ctx, 400, "Invalid request"); }
        catch (Exception e)
        {
            log.LogError(e, "Unhandled error on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, 500, "Something went wrong on the server");
        }
    }

    private static Task Write(HttpContext ctx, int status, string message)
    {
        if (ctx.Response.HasStarted) return Task.CompletedTask;
        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { error = message });
    }
}
