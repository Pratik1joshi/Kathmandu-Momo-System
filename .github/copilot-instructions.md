# AI Coding Agent Instructions for Restaurant POS System

## System Architecture Overview

This is a **hybrid offline-first restaurant POS system** with three interconnected projects:

1. **pos-restaurent-system** (main) - Restaurant POS with Next.js 16, React 19, SQLite
2. **pos-admin-central** - Central license management with Firebase/SQLite dual backend
3. **pos-system** - Legacy/simplified POS variant

### Multi-Database Architecture
- Each restaurant gets an **isolated SQLite database** named `pos_LICENSE_KEY.db`
- Database path determined by `databases/.license` file or ENV variable
- Uses **singleton pattern** via `Database.getInstance()` in `lib/db/index.js`
- WAL mode enabled for concurrent access, foreign keys enforced

## Critical Workflows

### Database Initialization
```bash
npm run db:seed          # Initialize & seed database
npm run db:reset         # Wipe and recreate (dev only)
node init-db.js          # Direct initialization
```

### Starting the System
```bash
npm run dev              # Dev mode (port 3000)
npm run build && npm start   # Production mode
.\Start-POS.bat          # Windows bundled launch
```

### License Activation Flow
1. First run shows activation screen (no `.license` file)
2. User enters license key from admin panel
3. System validates at `ADMIN_SERVER_URL` (default: `http://localhost:3001`)
4. Creates unique database: `databases/pos_LICENSE_KEY.db`
5. Writes `databases/.license` JSON with activation metadata
6. Initializes default admin user (username: `admin`, password: `admin123`)

## Project-Specific Patterns

### Path Aliasing
- Use `@/` for root-relative imports: `import { db } from '@/lib/db'`
- Configured in [jsconfig.json](jsconfig.json): `"@/*": ["./*"]`
- Applies to API routes, components, lib modules

### Authentication System
- **PIN-based** (4-6 digits) with bcrypt hashing, NOT traditional passwords
- Session tokens: 24-hour JWT stored in `sessions` table
- Role-based permissions: `admin`, `cashier`, `waiter`, `kitchen`
- Auth flow: `lib/auth/auth.js` → `app/api/auth/login/route.js`
- Default users seeded in [lib/db/seed.js](lib/db/seed.js) (5 roles)

### Repository Pattern (NOT ORM)
- Direct SQL via Better-SQLite3 with prepared statements
- Repositories in `lib/db/repositories/`: orders, menu, tables, bills, kots
- Transaction-based operations: `db.transaction(() => { ... })`
- Example: [lib/db/repositories/orders.js](lib/db/repositories/orders.js) - order creation with table assignment

### API Route Conventions
- Next.js App Router: `app/api/{module}/{action}/route.js`
- Export HTTP methods: `export async function GET()`, `POST()`, `PATCH()`
- Return `NextResponse.json()` for API responses
- Use `request.json()` to parse request body
- Example: [app/api/restaurant/orders/route.js](app/api/restaurant/orders/route.js)

### License Management Integration
- POS syncs with admin server at startup and periodically
- Check API: `GET /api/license/check` returns activation status + grace period
- License file: `databases/.license` (JSON) + `license_info` table
- Grace period (default 5 days) allows operation after expiry
- **System-wide blocking**: Middleware blocks ALL pages and API routes when `is_completely_expired`
- Expired systems redirect to `/license-expired` page (all features disabled)
- Only `/api/license/*` and `/api/auth/login` remain accessible when expired
- See [lib/license.js](lib/license.js) for status calculation logic

### Database Schema Essentials
- 20+ tables in [lib/db/schema.sql](lib/db/schema.sql)
- **Core**: `users`, `sessions`, `devices`, `tables`, `orders`, `order_items`
- **Restaurant**: `menu_categories`, `menu_items`, `menu_item_variants`, `kots`, `kot_items`
- **Financial**: `bills`, `bill_payments`, `customers`
- **Inventory**: `ingredients`, `recipe_ingredients`
- Auto-increment via triggers: `order_number`, `bill_number`, `kot_number`

### Component Structure
- UI components: Radix UI primitives in `components/ui/`
- Feature components: `components/{billing,menu,orders,customers}/`
- Server components by default (Next.js 13+ App Router)
- Client components: add `'use client'` directive for interactivity

## Key Integration Points

### Admin Server Communication
- License verification endpoint: `POST /api/verify-license` (admin server port 3001)
- POS checks license on startup via [app/api/license/check/route.js](app/api/license/check/route.js)
- Fallback to cached `.license` file if admin unreachable
- Firebase-based admin backend: `pos-admin-central/lib/firebase-admin.js`

### Order → KOT → Bill Flow
1. Waiter creates order (`POST /api/restaurant/orders`) → status `pending`
2. Order items sent to kitchen as KOT (`POST /api/restaurant/kots`)
3. Kitchen marks items ready → order status `ready`
4. Cashier generates bill (`POST /api/restaurant/bills`) → calculates total
5. Payment recorded → bill status `paid`, table freed

### Table Management
- Tables track `status`: `available`, `occupied`, `reserved`, `cleaning`
- Linking: `tables.current_order_id` → `orders.id`
- Waiter assignment: `tables.waiter_id` → `users.id`
- Floor/section organization for multi-floor restaurants

## Common Gotchas

1. **Database not found**: Run `npm run db:seed` before starting dev server
2. **Port conflicts**: Default port 3000; override via `PORT` env variable
3. **License file missing**: System enters "activation required" mode, not an error
4. **License expired blocking**: When `is_completely_expired = true`, middleware blocks ALL routes (pages + APIs) except `/license-expired`, `/activate`, `/login`, and `/api/license/*`
5. **bcrypt vs PIN hashing**: Auth uses bcrypt for password_hash column, despite PIN terminology
6. **Transaction scope**: Wrap multi-table operations in `db.transaction()` to prevent partial writes
7. **Better-SQLite3 sync**: All DB operations are synchronous, no async/await needed
8. **Windows paths**: Use `path.join(process.cwd(), ...)` not hardcoded slashes
9. **Middleware matcher**: Now includes `/api/*` routes (previously excluded) to enforce license checks on API endpoints

## Testing the System

### Default Login Credentials
| Role    | Username | PIN    | Access                   |
|---------|----------|--------|--------------------------|
| Admin   | admin    | 123456 | Full system access       |
| Waiter  | john     | 1234   | Orders, tables, menu     |
| Waiter  | ram      | 4567   | Orders, tables, menu     |
| Cashier | sita     | 7890   | Bills, payments, orders  |
| Kitchen | chef     | 1111   | KOTs, order status       |

### Quick API Test (PowerShell)
```powershell
# Login
$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"username":"admin","pin":"123456","deviceId":"test-pc"}'

# Get menu items
Invoke-RestMethod -Uri "http://localhost:3000/api/restaurant/menu" `
  -Headers @{Authorization="Bearer $($login.token)"}
```

## Documentation References
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Complete system architecture
- [GETTING_STARTED.md](GETTING_STARTED.md) - Setup instructions
- [API_TESTING.md](API_TESTING.md) - Full API endpoint documentation
- [BUILD_STATUS.md](BUILD_STATUS.md) - Current development status
- [ACTIVATION_GUIDE.md](ACTIVATION_GUIDE.md) - License activation flow
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) - Detailed technical architecture

## Development Focus Areas

- **Backend**: ✅ Complete (authentication, CRUD APIs, database layer)
- **Frontend**: ⏳ In Progress (UI components, role-specific dashboards)
- **Real-time**: 🔜 Planned (Socket.io for live order updates)
- **Offline sync**: 🔜 Planned (IndexedDB with background sync)
- **Hardware integration**: 🔜 Planned (thermal printer, barcode scanner)
