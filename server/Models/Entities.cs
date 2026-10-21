using System.Text.Json.Serialization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace StockPilot.Api.Models;

// These classes map 1:1 onto the MongoDB collections the Node/Mongoose version used
// (same collection names, same field names), so an existing database keeps working.
// The Mongo _id is hidden from API responses with [JsonIgnore], exactly like the old
// Node code stripped _id and __v.

public class Product
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string Barcode { get; set; }
    public string Name { get; set; }
    public string Unit { get; set; } = "kg";
    public string Group { get; set; }
    public double Buy { get; set; }   // purchase price
    public double Mrp { get; set; }   // selling price (MRP)
}

public class ProductGroup
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string Name { get; set; }
}

public class Warehouse
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string Name { get; set; }
}

// One row per (warehouse, product)
public class StockItem
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string Warehouse { get; set; }
    public string Barcode { get; set; }
    public double Qty { get; set; }
}

// Atomic invoice-number counters ("purchase" / "sale"). Seq = last number used.
public class Counter
{
    [BsonId] public string Id { get; set; }
    public long Seq { get; set; }
}

public class PurchaseLine
{
    public string Barcode { get; set; }
    public string Name { get; set; }
    public string Unit { get; set; }
    public double Qty { get; set; }
    public double Buy { get; set; }
    public double Mrp { get; set; }
    public double Total { get; set; }
}

public class Purchase
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string No { get; set; }                 // PUR-00012
    public string Party { get; set; } = "—";       // supplier
    public string Bill { get; set; } = "";         // vendor bill no
    public string Wh { get; set; }
    public string Method { get; set; }
    public string Status { get; set; } = "Paid";   // Paid | Pending | Partial
    public double Total { get; set; }
    public double Units { get; set; }
    public long Ts { get; set; }
    public string By { get; set; } = "";
    public List<PurchaseLine> Lines { get; set; } = new();
}

public class SaleLine
{
    public string Barcode { get; set; }
    public string Name { get; set; }
    public string Unit { get; set; }
    public double Qty { get; set; }
    public double Price { get; set; }
    public double Disc { get; set; }
    public double Mrp { get; set; }
    public double Total { get; set; }
}

public class Sale
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string No { get; set; }                 // SAL-00042
    public string Party { get; set; } = "Walk-in customer";
    public string Wh { get; set; }
    public string Method { get; set; }
    public string Status { get; set; } = "Paid";
    public double Total { get; set; }
    public double Units { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public double? Received { get; set; }
    public double Change { get; set; }
    public long Ts { get; set; }
    public string By { get; set; } = "";
    public List<SaleLine> Lines { get; set; } = new();
}

public class Transfer
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public long Ts { get; set; }
    public string From { get; set; }
    public string To { get; set; }
    public string Barcode { get; set; }
    public string Name { get; set; }
    public double Qty { get; set; }
    public string By { get; set; }
}

public class Perms
{
    public bool Sales { get; set; }
    public bool Purchase { get; set; }
    public bool Products { get; set; }
    public bool Warehouse { get; set; }
    public bool Reports { get; set; }

    public static Perms All() => new() { Sales = true, Purchase = true, Products = true, Warehouse = true, Reports = true };

    public bool Get(string section) => section switch
    {
        "sales" => Sales,
        "purchase" => Purchase,
        "products" => Products,
        "warehouse" => Warehouse,
        "reports" => Reports,
        _ => false
    };

    public void Set(string section, bool value)
    {
        switch (section)
        {
            case "sales": Sales = value; break;
            case "purchase": Purchase = value; break;
            case "products": Products = value; break;
            case "warehouse": Warehouse = value; break;
            case "reports": Reports = value; break;
        }
    }
}

public class StaffMember
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string Name { get; set; }
    public string Role { get; set; } = "Cashier";
    public string PinHash { get; set; }            // PINs are stored hashed, never in plain text
    public Perms Perms { get; set; } = new();
}

public class Setting
{
    [BsonId, BsonRepresentation(BsonType.ObjectId), JsonIgnore] public string Id { get; set; }
    public string Key { get; set; } = "main";
    public string AdminName { get; set; } = "Admin";
    public string AdminPasswordHash { get; set; }
    public string ShopName { get; set; } = "Your Shop Name";
    public string ShopLine { get; set; } = "Shop address · Phone number";
}
