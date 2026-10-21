using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;

namespace StockPilot.Api.Services;

// One place that knows the collection names (identical to the ones Mongoose created)
public class MongoDb
{
    public IMongoCollection<Product> Products { get; }
    public IMongoCollection<ProductGroup> Groups { get; }
    public IMongoCollection<Warehouse> Warehouses { get; }
    public IMongoCollection<StockItem> Stocks { get; }
    public IMongoCollection<Purchase> Purchases { get; }
    public IMongoCollection<Sale> Sales { get; }
    public IMongoCollection<Transfer> Transfers { get; }
    public IMongoCollection<StaffMember> Staffs { get; }
    public IMongoCollection<Setting> Settings { get; }
    public IMongoCollection<Counter> Counters { get; }

    public MongoDb(StockPilotOptions opts)
    {
        var url = new MongoUrl(opts.MongoDbUri);
        var db = new MongoClient(url).GetDatabase(string.IsNullOrEmpty(url.DatabaseName) ? "stockpilot" : url.DatabaseName);
        Products = db.GetCollection<Product>("products");
        Groups = db.GetCollection<ProductGroup>("groups");
        Warehouses = db.GetCollection<Warehouse>("warehouses");
        Stocks = db.GetCollection<StockItem>("stocks");
        Purchases = db.GetCollection<Purchase>("purchases");
        Sales = db.GetCollection<Sale>("sales");
        Transfers = db.GetCollection<Transfer>("transfers");
        Staffs = db.GetCollection<StaffMember>("staffs");
        Settings = db.GetCollection<Setting>("settings");
        Counters = db.GetCollection<Counter>("counters");
    }
}
