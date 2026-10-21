using System.Globalization;

namespace StockPilot.Api.Infrastructure;

public class HttpError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public static class Util
{
    // Same rounding as JavaScript's Math.round (half away from zero for positive numbers)
    public static double Round2(double n) => Math.Round(n * 100, MidpointRounding.AwayFromZero) / 100;
    public static string NumFmt(string prefix, long n) => $"{prefix}-{n:D5}";
    public static string Clean(string v) => (v ?? "").Trim();
    public static string Num(double d) => d.ToString(CultureInfo.InvariantCulture);
}
