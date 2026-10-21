namespace StockPilot.Api.Models;

// Request bodies. Property names match the JSON the React client already sends (case-insensitive).

public class LoginRequest { public string Mode { get; set; } public string Password { get; set; } public string Name { get; set; } public string Pin { get; set; } }

public class ProductCreate { public string Barcode { get; set; } public string Name { get; set; } public string Unit { get; set; } public string Group { get; set; } public double? Buy { get; set; } public double? Mrp { get; set; } }
public class ProductPatch { public string Name { get; set; } public string Group { get; set; } public string Unit { get; set; } public double? Buy { get; set; } public double? Mrp { get; set; } }

public class GroupBody { public string Name { get; set; } }

public class PurchaseLineIn { public string Barcode { get; set; } public double? Qty { get; set; } public double? Buy { get; set; } public double? Mrp { get; set; } }
public class PurchaseRequest { public string Vendor { get; set; } public string Bill { get; set; } public string Wh { get; set; } public string Method { get; set; } public string Status { get; set; } public List<PurchaseLineIn> Lines { get; set; } }

public class SaleLineIn { public string Barcode { get; set; } public double? Qty { get; set; } public double? Price { get; set; } public double? Disc { get; set; } }
public class SaleRequest { public string Customer { get; set; } public string Wh { get; set; } public string Method { get; set; } public string Status { get; set; } public double? Cash { get; set; } public List<SaleLineIn> Lines { get; set; } }

public class TransferRequest { public string From { get; set; } public string To { get; set; } public string Barcode { get; set; } public double? Qty { get; set; } }

public class StaffCreate { public string Name { get; set; } public string Role { get; set; } public string Pin { get; set; } public Dictionary<string, bool> Perms { get; set; } }
public class StaffPatch { public string Role { get; set; } public string Pin { get; set; } public Dictionary<string, bool?> Perms { get; set; } }

public class PasswordChange { public string Current { get; set; } public string Next { get; set; } }
public class ShopBody { public string Name { get; set; } public string Line { get; set; } }

public record UserDto(string Type, string Name, string Role, Perms Perms);
