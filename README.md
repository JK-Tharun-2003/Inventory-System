# StockPilot (React + ASP.NET Core + MongoDB)

Same StockPilot app, same React screens, same API URLs and JSON - but the backend is now
**ASP.NET Core (.NET 8)** instead of Node.js/Express. The React client was not changed.

## Run it

You need the **.NET 8 SDK** and **MongoDB** (local install or a free Atlas cluster).
Node.js is only needed for the React front-end tooling (Vite); it is no longer part of the backend.

```bash
npm run install:all     # root + client npm packages, and `dotnet restore server`
npm run seed            # loads sample data (WIPES the stockpilot database)
npm run dev             # API on :5000 (dotnet watch), web app on http://localhost:5173
```

Sign in with **Admin password `admin123`** or **Staff PIN `1234`**. Without seeding, an empty database still works:
the server creates the admin login `admin123`, the default groups and the two warehouses on first start.

Settings live in `server/appsettings.json` (section `StockPilot`): `MongoDbUri`, `JwtSecret`, `JwtExpiresHours`,
`ClientOrigin`, `LowStock`, `AlertStock`. Any of them can be overridden with environment variables, e.g.
`StockPilot__JwtSecret=...`, `StockPilot__MongoDbUri=...`.

### Production

```bash
npm run build                                   # builds the React app into client/dist
dotnet publish server -c Release -o publish     # copies client/dist into publish/wwwroot
export ASPNETCORE_ENVIRONMENT=Production
export StockPilot__JwtSecret="a-long-random-string"
dotnet publish/StockPilot.Api.dll               # API + React app from one port (5000, see "Urls" in appsettings.json)
```
In Production the server refuses to start with the default JWT secret.

## Node.js -> .NET map

| Node.js (old)                          | ASP.NET Core (new) |
|----------------------------------------|--------------------|
| `src/index.js`, `app.js`               | `Program.cs` |
| `config/index.js`, `.env`              | `Infrastructure/Config.cs`, `appsettings.json` |
| `config/db.js`, Mongoose models        | `Services/MongoDb.cs`, `Models/Entities.cs` (official `MongoDB.Driver`) |
| `ensureDefaults.js`                    | `Services/Bootstrapper.cs` |
| `seed.js`                              | `Services/Seeder.cs` (`npm run seed`) |
| `middleware/auth.js`                   | `Infrastructure/StockAuthAttribute.cs`, `Services/AuthService.cs`, `Services/JwtService.cs` |
| `middleware/error.js`                  | `Infrastructure/ErrorMiddleware.cs` |
| `utils/stock.js`, `models/Counter.js`  | `Services/DataServices.cs` (`StockService`, `CounterService`) |
| `routes/*.js`                          | `Controllers/*Controller.cs` |
| bcryptjs / jsonwebtoken                | BCrypt.Net-Next / Microsoft.IdentityModel.JsonWebTokens |
| express-rate-limit / helmet / cors     | built-in rate limiter / security-header middleware / built-in CORS |

The MongoDB collection names and field names are unchanged, and bcrypt hashes are compatible, so a database
created by the Node version works as-is (existing passwords and PINs keep working).

## API (unchanged, all under `/api`, JWT bearer token)

| Area | Endpoints | Who |
|------|-----------|-----|
| Auth | `GET auth/staff-names`, `POST auth/login`, `GET auth/me` | public / signed in |
| Load data | `GET bootstrap` | signed in |
| Products | `POST products`, `PATCH products/{barcode}`, `DELETE products/{barcode}` | Products access / delete = admin |
| Groups | `POST groups`, `PATCH groups/{name}`, `DELETE groups/{name}` | Products access / delete = admin |
| Purchases | `GET purchases`, `GET purchases/suppliers`, `POST purchases` | Purchase access |
| Sales | `GET sales`, `POST sales` | Sales access |
| Transfers | `GET transfers`, `POST transfers` | Warehouse access |
| Reports | `GET reports/summary`, `reports/trend?days=30`, `reports/party/{sales\|purchases}`, `reports/stock` | Reports access |
| Staff | `GET/POST staff`, `PATCH/DELETE staff/{id}` | admin only |
| Settings | `PUT settings/password`, `PUT settings/shop` | admin only |
| Health | `GET health` | public |

## Honest note on testing
The .NET code could not be restored or compiled where it was written (the sandbox blocks NuGet), so it has been
checked for syntax and ASP.NET API usage only. Your first `dotnet restore` + `npm run seed` + `npm run dev` is the
real test: please click through one sale, one purchase and one transfer and report anything that misbehaves.
