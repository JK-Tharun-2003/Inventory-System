using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;

namespace StockPilot.Api.Services;

// Replaces ensureDefaults.js: makes a brand-new empty database usable
// (admin login, default groups, two warehouses) and creates the unique indexes.
public class Bootstrapper(MongoDb db, SettingsService settings, ILogger<Bootstrapper> log)
{
    public async Task InitAsync()
    {
        await EnsureIndexesAsync();
        await settings.GetAsync();

        if (await db.Groups.CountDocumentsAsync(Builders<ProductGroup>.Filter.Empty) == 0)
            foreach (var name in Defaults.Groups) await db.Groups.InsertOneAsync(new ProductGroup { Name = name });

        if (await db.Warehouses.CountDocumentsAsync(Builders<Warehouse>.Filter.Empty) == 0)
            foreach (var name in Defaults.Warehouses) await db.Warehouses.InsertOneAsync(new Warehouse { Name = name });
    }

    private async Task EnsureIndexesAsync()
    {
        try
        {
            var unique = new CreateIndexOptions { Unique = true };
            await db.Products.Indexes.CreateOneAsync(new CreateIndexModel<Product>(Builders<Product>.IndexKeys.Ascending(x => x.Barcode), unique));
            await db.Groups.Indexes.CreateOneAsync(new CreateIndexModel<ProductGroup>(Builders<ProductGroup>.IndexKeys.Ascending(x => x.Name), unique));
            await db.Warehouses.Indexes.CreateOneAsync(new CreateIndexModel<Warehouse>(Builders<Warehouse>.IndexKeys.Ascending(x => x.Name), unique));
            await db.Stocks.Indexes.CreateOneAsync(new CreateIndexModel<StockItem>(Builders<StockItem>.IndexKeys.Ascending(x => x.Warehouse).Ascending(x => x.Barcode), unique));
            await db.Purchases.Indexes.CreateOneAsync(new CreateIndexModel<Purchase>(Builders<Purchase>.IndexKeys.Ascending(x => x.No), unique));
            await db.Sales.Indexes.CreateOneAsync(new CreateIndexModel<Sale>(Builders<Sale>.IndexKeys.Ascending(x => x.No), unique));
            await db.Staffs.Indexes.CreateOneAsync(new CreateIndexModel<StaffMember>(Builders<StaffMember>.IndexKeys.Ascending(x => x.Name), unique));
            await db.Settings.Indexes.CreateOneAsync(new CreateIndexModel<Setting>(Builders<Setting>.IndexKeys.Ascending(x => x.Key), unique));
            await db.Purchases.Indexes.CreateOneAsync(new CreateIndexModel<Purchase>(Builders<Purchase>.IndexKeys.Ascending(x => x.Ts)));
            await db.Sales.Indexes.CreateOneAsync(new CreateIndexModel<Sale>(Builders<Sale>.IndexKeys.Ascending(x => x.Ts)));
            await db.Transfers.Indexes.CreateOneAsync(new CreateIndexModel<Transfer>(Builders<Transfer>.IndexKeys.Ascending(x => x.Ts)));
        }
        catch (MongoCommandException e)
        {
            // e.g. an index with the same name but different options already exists - not fatal
            log.LogWarning("Could not create an index: {Message}", e.Message);
        }
    }
}
