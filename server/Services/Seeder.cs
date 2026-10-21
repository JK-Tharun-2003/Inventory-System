using MongoDB.Driver;
using StockPilot.Api.Infrastructure;
using StockPilot.Api.Models;

namespace StockPilot.Api.Services;

// Replaces seed.js. Run with:  dotnet run --project server -- --seed
// WARNING: wipes the StockPilot collections first.
public class Seeder(MongoDb db, Bootstrapper bootstrapper)
{
    public async Task RunAsync()
    {
        const long Day = 86400000L;
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        await db.Products.DeleteManyAsync(Builders<Product>.Filter.Empty);
        await db.Groups.DeleteManyAsync(Builders<ProductGroup>.Filter.Empty);
        await db.Warehouses.DeleteManyAsync(Builders<Warehouse>.Filter.Empty);
        await db.Stocks.DeleteManyAsync(Builders<StockItem>.Filter.Empty);
        await db.Purchases.DeleteManyAsync(Builders<Purchase>.Filter.Empty);
        await db.Sales.DeleteManyAsync(Builders<Sale>.Filter.Empty);
        await db.Transfers.DeleteManyAsync(Builders<Transfer>.Filter.Empty);
        await db.Staffs.DeleteManyAsync(Builders<StaffMember>.Filter.Empty);
        await db.Settings.DeleteManyAsync(Builders<Setting>.Filter.Empty);
        await db.Counters.DeleteManyAsync(Builders<Counter>.Filter.Empty);

        await bootstrapper.InitAsync();   // indexes + admin login (admin123) + default groups + warehouses

        await db.Products.InsertManyAsync(new[]
        {
            new Product { Barcode = "8901234500001", Name = "Samba rice", Unit = "kg", Group = "Grocery", Buy = 225, Mrp = 260 },
            new Product { Barcode = "8901234500002", Name = "Dhal", Unit = "kg", Group = "Grocery", Buy = 360, Mrp = 420 },
            new Product { Barcode = "8901234500003", Name = "Wheat flour", Unit = "kg", Group = "Grocery", Buy = 190, Mrp = 220 },
            new Product { Barcode = "8901234500004", Name = "Sugar", Unit = "kg", Group = "Grocery", Buy = 235, Mrp = 270 }
        });

        StockItem S(string wh, string bc, double q) => new() { Warehouse = wh, Barcode = bc, Qty = q };
        await db.Stocks.InsertManyAsync(new[]
        {
            S("Main store", "8901234500001", 120), S("Main store", "8901234500002", 60),
            S("Main store", "8901234500003", 45),  S("Main store", "8901234500004", 80),
            S("Branch store", "8901234500001", 30), S("Branch store", "8901234500002", 15),
            S("Branch store", "8901234500003", 20), S("Branch store", "8901234500004", 25)
        });

        await db.Purchases.InsertManyAsync(new[]
        {
            new Purchase { No = "PUR-00010", Party = "Sri Traders", Total = 42500, Units = 180, Ts = now - 6 * Day, Status = "Paid", Method = "Cash", Wh = "Main store", By = "Kajaa" },
            new Purchase { No = "PUR-00011", Party = "Lanka Foods", Total = 28400, Units = 110, Ts = now - 2 * Day, Status = "Pending", Method = "Bank transfer", Wh = "Main store", By = "Kajaa" }
        });
        await db.Sales.InsertManyAsync(new[]
        {
            new Sale { No = "SAL-00039", Party = "Walk-in customer", Total = 8450, Units = 30, Ts = now - 4 * Day, Status = "Paid", Method = "Cash", Wh = "Main store", By = "Nimali Perera" },
            new Sale { No = "SAL-00040", Party = "Nimal Stores", Total = 21300, Units = 75, Ts = now - 3 * Day, Status = "Paid", Method = "Bank transfer", Wh = "Main store", By = "Nimali Perera" },
            new Sale { No = "SAL-00041", Party = "Walk-in customer", Total = 5120, Units = 18, Ts = now - 1 * Day, Status = "Paid", Method = "Cash", Wh = "Main store", By = "Nimali Perera" }
        });
        await db.Counters.InsertManyAsync(new[] { new Counter { Id = "purchase", Seq = 11 }, new Counter { Id = "sale", Seq = 41 } });

        var pin = BCrypt.Net.BCrypt.HashPassword("1234", 10);
        await db.Staffs.InsertOneAsync(new StaffMember { Name = "Kajaa", Role = "Manager", PinHash = pin, Perms = Perms.All() });
        await db.Staffs.InsertOneAsync(new StaffMember { Name = "Nimali Perera", Role = "Cashier", PinHash = pin, Perms = new Perms { Sales = true } });
        await db.Staffs.InsertOneAsync(new StaffMember { Name = "Ravi Kumar", Role = "Store keeper", PinHash = pin, Perms = new Perms { Purchase = true, Products = true, Warehouse = true } });

        Console.WriteLine("Sample data loaded.\n  Admin password: admin123\n  Staff PIN (everyone): 1234");
    }
}
