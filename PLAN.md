# Vorratio Development Plan

> **Vorratio** - A smart home inventory management PWA for tracking what you have, what you consume, and what you need to buy.

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [Feature Implementation Phases](#4-feature-implementation-phases)
5. [API Specification](#5-api-specification)
6. [UI/UX Design](#6-uiux-design)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. Project Overview

### Core Philosophy
- **Inventory is truth** → Everything is based on real batches with expiration dates
- **Plan + Consumption = Demand** → Nothing is guessed, everything is explained
- **Foresight over reaction** → The app thinks ahead to the next shopping trip
- **Minimal input** → Barcode scanning, quick actions, smart defaults

### Technology Stack (matching TickForge)
| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 5, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Fastify, Prisma ORM |
| **Database** | SQLite (local, self-contained) |
| **PWA** | vite-plugin-pwa, Workbox |
| **Auth** | Session-based (Fastify-session), app password |
| **i18n** | Custom YAML-based (EN + DE) |
| **Deployment** | Docker, docker-compose |

### Project Structure
```
Vorratio/
├── packages/
│   ├── api/                      # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts          # Server setup + daily jobs
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts       # Password hashing
│   │   │   │   ├── db.ts         # Prisma singleton
│   │   │   │   ├── forecast.ts   # Consumption prediction
│   │   │   │   └── shopping.ts   # Shopping list calculation
│   │   │   └── routes/
│   │   │       ├── auth.ts
│   │   │       ├── articles.ts
│   │   │       ├── batches.ts
│   │   │       ├── recipes.ts
│   │   │       ├── meal-plan.ts
│   │   │       ├── shopping-list.ts
│   │   │       ├── barcode.ts
│   │   │       └── settings.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   │
│   └── web/                      # React PWA frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Layout.tsx
│       │   │   ├── ArticleCard.tsx
│       │   │   ├── BatchList.tsx
│       │   │   ├── BarcodeScanner.tsx
│       │   │   ├── RecipeCard.tsx
│       │   │   ├── ShoppingItem.tsx
│       │   │   ├── NutritionSummary.tsx
│       │   │   └── ExpiryWarning.tsx
│       │   ├── pages/
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── InventoryPage.tsx
│       │   │   ├── ArticleDetailPage.tsx
│       │   │   ├── ArticleEditPage.tsx
│       │   │   ├── RecipesPage.tsx
│       │   │   ├── RecipeDetailPage.tsx
│       │   │   ├── RecipeEditPage.tsx
│       │   │   ├── MealPlanPage.tsx
│       │   │   ├── ShoppingListPage.tsx
│       │   │   ├── ScanPage.tsx
│       │   │   ├── SettingsPage.tsx
│       │   │   └── LoginPage.tsx
│       │   ├── context/
│       │   │   └── AuthContext.tsx
│       │   ├── i18n/
│       │   │   ├── context.tsx
│       │   │   ├── useTranslation.ts
│       │   │   └── locales/
│       │   │       ├── en.yaml
│       │   │       └── de.yaml
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   ├── hooks.ts
│       │   │   └── utils.ts
│       │   └── index.css
│       ├── public/
│       │   └── icons/
│       ├── index.html
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── PLAN.md
└── README.md
```

---

## 2. Architecture

### Backend Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         Fastify Server                          │
├─────────────────────────────────────────────────────────────────┤
│  Routes                                                         │
│  ├── /api/auth/*           (login, logout, password change)     │
│  ├── /api/articles/*       (CRUD + search + barcode lookup)     │
│  ├── /api/batches/*        (CRUD + consume + inventory)         │
│  ├── /api/recipes/*        (CRUD + flexible ingredients)        │
│  ├── /api/meal-plan/*      (CRUD + portion calculation)         │
│  ├── /api/shopping-list/*  (generate, update, checkout)         │
│  ├── /api/consumption/*    (log, forecast)                      │
│  └── /api/settings/*       (locale, password)                   │
├─────────────────────────────────────────────────────────────────┤
│  Lib                                                            │
│  ├── auth.ts       → Password hashing (SHA256 + salt)           │
│  ├── db.ts         → Prisma singleton                           │
│  ├── forecast.ts   → Consumption prediction algorithms          │
│  └── shopping.ts   → Shopping list calculation logic            │
├─────────────────────────────────────────────────────────────────┤
│  Daily Jobs (scheduled at 00:05)                                │
│  ├── Check expiring batches → Generate warnings                 │
│  └── Update consumption forecasts                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prisma ORM + SQLite                          │
│  • Single file database: /data/vorratio.db                      │
│  • Auto-migrations on startup                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         React App                               │
├─────────────────────────────────────────────────────────────────┤
│  Contexts                                                       │
│  ├── AuthContext     → isAuthenticated, login, logout           │
│  └── LocaleContext   → t(), locale, setLocale                   │
├─────────────────────────────────────────────────────────────────┤
│  Pages (React Router)                                           │
│  ├── /              → Dashboard (expiring, low stock, today)    │
│  ├── /inventory     → All articles by location                  │
│  ├── /article/:id   → Article detail + batches                  │
│  ├── /article/new   → Create article                            │
│  ├── /recipes       → Recipe list                               │
│  ├── /recipe/:id    → Recipe detail                             │
│  ├── /recipe/new    → Create recipe                             │
│  ├── /meal-plan     → Weekly meal plan                          │
│  ├── /shopping      → Shopping list                             │
│  ├── /scan          → Barcode scanner                           │
│  ├── /settings      → App settings                              │
│  └── /login         → Password entry                            │
├─────────────────────────────────────────────────────────────────┤
│  PWA Features                                                   │
│  ├── Service Worker → Cache static assets + API responses       │
│  ├── Manifest       → Installable on home screen                │
│  └── Offline        → View cached inventory when offline        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
```
User Action → API Call → Database Update → Response → UI Update
                              │
                              ▼
                    Batch-based Inventory
                    ┌─────────────────────┐
                    │ Article A           │
                    │ ├── Batch 1 (5 pcs) │ ← Expires Jan 20
                    │ ├── Batch 2 (3 pcs) │ ← Expires Jan 25
                    │ └── Total: 8 pcs    │
                    └─────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    Consumption         Meal Planning       Shopping List
    (FIFO: oldest       (Recipes →          (Plan - Stock
     batch first)        Ingredients)         = Need)
```

---

## 3. Data Model

### Entity Relationship Diagram
```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│     Article       │     │      Batch        │     │  StorageLocation  │
├───────────────────┤     ├───────────────────┤     ├───────────────────┤
│ id (uuid)         │────<│ id (uuid)         │     │ id (uuid)         │
│ name              │     │ articleId (FK)    │>────│ name              │
│ barcode?          │     │ quantity          │     │ sortOrder         │
│ defaultUnit       │     │ purchaseDate      │     │ icon?             │
│ packageSize       │     │ expiryDate?       │     └───────────────────┘
│ packageUnit       │     │ purchasePrice?    │              │
│ locationId (FK)   │>────│ notes?            │              │
│ minStock?         │     │ createdAt         │              │
│ defaultExpiry?    │     └───────────────────┘              │
│ nutritionPer100g? │                                        │
│ category?         │<───────────────────────────────────────┘
│ isConsumable      │     ┌───────────────────┐     ┌───────────────────┐
│ sortOrder         │     │      Recipe       │     │  RecipeIngredient │
│ createdAt         │     ├───────────────────┤     ├───────────────────┤
│ updatedAt         │────<│ id (uuid)         │────<│ id (uuid)         │
└───────────────────┘     │ name              │     │ recipeId (FK)     │
                          │ description?      │     │ articleId? (FK)   │
┌───────────────────┐     │ servings          │     │ categoryMatch?    │
│ ConsumptionLog    │     │ instructions?     │     │ quantity          │
├───────────────────┤     │ prepTime?         │     │ unit              │
│ id (uuid)         │     │ cookTime?         │     │ isOptional        │
│ articleId (FK)    │>────│ imageUrl?         │     │ notes?            │
│ batchId? (FK)     │     │ tags?             │     └───────────────────┘
│ quantity          │     │ createdAt         │              │
│ consumedAt        │     │ updatedAt         │              │
│ source            │     └───────────────────┘              │
│ (MANUAL/RECIPE/   │              │                         │
│  EXPIRED/WASTE)   │              │                         │
└───────────────────┘     ┌───────────────────┐              │
                          │   MealPlanEntry   │              │
┌───────────────────┐     ├───────────────────┤              │
│    AppSettings    │     │ id (uuid)         │              │
├───────────────────┤     │ date              │              │
│ id ('app')        │     │ mealType          │              │
│ password (hashed) │     │ (BREAKFAST/LUNCH/ │              │
│ locale            │     │  DINNER/SNACK)    │              │
│ defaultShopDay    │     │ recipeId (FK)     │>─────────────┘
│ currency          │     │ servings          │
└───────────────────┘     │ notes?            │
                          │ completedAt?      │
                          └───────────────────┘

┌───────────────────┐     ┌───────────────────┐
│   ShoppingList    │     │ ShoppingListItem  │
├───────────────────┤     ├───────────────────┤
│ id (uuid)         │────<│ id (uuid)         │
│ name              │     │ listId (FK)       │
│ shopDate          │     │ articleId? (FK)   │
│ planUntilDate     │     │ customName?       │
│ status (ACTIVE/   │     │ neededQuantity    │
│  COMPLETED)       │     │ recommendedPacks  │
│ createdAt         │     │ estimatedPrice?   │
│ completedAt?      │     │ isPurchased       │
└───────────────────┘     │ purchasedQuantity?│
                          │ actualPrice?      │
                          │ reason            │
                          │ (RECIPE/LOW_STOCK/│
                          │  FORECAST/MANUAL) │
                          └───────────────────┘
```

### Prisma Schema

```prisma
// packages/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ==================== Core Entities ====================

model StorageLocation {
  id        String    @id @default(uuid())
  name      String
  icon      String?
  sortOrder Int       @default(0)
  articles  Article[]
}

model Article {
  id              String    @id @default(uuid())
  name            String
  barcode         String?   @unique
  defaultUnit     String    @default("pcs") // pcs, g, ml, kg, l
  packageSize     Float     @default(1)
  packageUnit     String    @default("pcs")

  locationId      String?
  location        StorageLocation? @relation(fields: [locationId], references: [id])

  minStock        Float?    // Alert when below this
  defaultExpiryDays Int?    // Auto-calculate expiry on purchase

  // Nutrition per 100g/100ml (optional)
  calories        Float?
  protein         Float?
  carbs           Float?
  fat             Float?
  fiber           Float?

  category        String?   // For flexible recipe matching
  isConsumable    Boolean   @default(true) // false for non-food items
  sortOrder       Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  batches         Batch[]
  consumptionLogs ConsumptionLog[]
  recipeIngredients RecipeIngredient[]
  shoppingItems   ShoppingListItem[]
}

model Batch {
  id            String    @id @default(uuid())
  articleId     String
  article       Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)

  quantity      Float     // Current quantity in defaultUnit
  initialQuantity Float   // Original quantity when purchased
  purchaseDate  DateTime  @default(now())
  expiryDate    DateTime?
  purchasePrice Float?    // Price for this batch
  notes         String?

  createdAt     DateTime  @default(now())

  consumptionLogs ConsumptionLog[]
}

model ConsumptionLog {
  id         String   @id @default(uuid())
  articleId  String
  article    Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  batchId    String?
  batch      Batch?   @relation(fields: [batchId], references: [id], onDelete: SetNull)

  quantity   Float
  consumedAt DateTime @default(now())
  source     String   @default("MANUAL") // MANUAL, RECIPE, EXPIRED, WASTE
  recipeId   String?  // If consumed via recipe
  notes      String?
}

// ==================== Recipes & Meal Planning ====================

model Recipe {
  id           String    @id @default(uuid())
  name         String
  description  String?
  servings     Int       @default(2)
  instructions String?   // Markdown or plain text
  prepTime     Int?      // Minutes
  cookTime     Int?      // Minutes
  imageUrl     String?
  tags         String?   // Comma-separated: "quick,vegetarian,dinner"

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  ingredients  RecipeIngredient[]
  mealPlanEntries MealPlanEntry[]
}

model RecipeIngredient {
  id            String   @id @default(uuid())
  recipeId      String
  recipe        Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  // Either specific article OR category match
  articleId     String?
  article       Article? @relation(fields: [articleId], references: [id], onDelete: SetNull)
  categoryMatch String?  // e.g., "pasta" matches any article with category "pasta"

  quantity      Float
  unit          String   // Same units as Article.defaultUnit
  isOptional    Boolean  @default(false)
  notes         String?  // "finely chopped", "room temperature"
}

model MealPlanEntry {
  id          String    @id @default(uuid())
  date        DateTime
  mealType    String    // BREAKFAST, LUNCH, DINNER, SNACK

  recipeId    String
  recipe      Recipe    @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  servings    Int       // Can differ from recipe default
  notes       String?
  completedAt DateTime? // When meal was prepared

  @@unique([date, mealType])
}

// ==================== Shopping ====================

model ShoppingList {
  id            String   @id @default(uuid())
  name          String   @default("Shopping List")
  shopDate      DateTime // When you plan to shop
  planUntilDate DateTime // Calculate needs until this date
  status        String   @default("ACTIVE") // ACTIVE, COMPLETED

  createdAt     DateTime @default(now())
  completedAt   DateTime?

  items         ShoppingListItem[]
}

model ShoppingListItem {
  id                String       @id @default(uuid())
  listId            String
  list              ShoppingList @relation(fields: [listId], references: [id], onDelete: Cascade)

  // Either linked article or custom item
  articleId         String?
  article           Article?     @relation(fields: [articleId], references: [id], onDelete: SetNull)
  customName        String?

  neededQuantity    Float        // In article's defaultUnit
  recommendedPacks  Int          @default(1)
  estimatedPrice    Float?

  isPurchased       Boolean      @default(false)
  purchasedQuantity Float?
  actualPrice       Float?

  reason            String       // RECIPE, LOW_STOCK, FORECAST, MANUAL
  reasonDetails     String?      // e.g., "Recipe: Spaghetti Bolognese"
}

// ==================== Settings ====================

model AppSettings {
  id              String   @id @default("app")
  password        String   // Hashed with salt
  locale          String   @default("en")
  defaultShopDay  Int      @default(6) // 0=Sun, 6=Sat
  currency        String   @default("EUR")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 4. Feature Implementation Phases

### Phase 1: Foundation (MVP) - COMPLETED
**Goal**: Basic inventory management with batch tracking

- [x] Project setup (monorepo, TypeScript, configs)
- [x] Database schema + Prisma setup
- [x] Basic auth (app password)
- [x] Storage locations CRUD
- [x] Articles CRUD
- [x] Batches CRUD (add purchase, consume)
- [x] Basic inventory view (list by location)
- [x] PWA setup (manifest, service worker)
- [x] i18n (EN + DE)
- [x] Docker setup
- [x] Dashboard with stats
- [x] Expiry warnings (basic)
- [x] Low stock warnings (basic)
- [x] FIFO consumption

**Deliverables**:
- Add articles with barcode
- Add purchase batches with expiry
- Consume from inventory (FIFO)
- View inventory by location

### Phase 2: Expiry & Consumption
**Goal**: Smart expiry warnings + consumption tracking

- [ ] Expiry warning system (soon, expired)
- [ ] Dashboard with expiry overview
- [ ] FIFO consumption (oldest batch first)
- [ ] Consumption logging
- [ ] Consumption history view
- [ ] Inventory correction (adjust batch quantities)
- [ ] Low stock warnings (below minStock)

**Deliverables**:
- See what expires soon
- Track consumption history
- Auto-consume oldest batch
- Get low stock alerts

### Phase 3: Recipes & Meal Planning
**Goal**: Recipe management + weekly meal plan

- [ ] Recipes CRUD
- [ ] Recipe ingredients (specific + flexible)
- [ ] Recipe detail view with nutrition
- [ ] Meal plan (day/week view)
- [ ] Portion adjustment
- [ ] "Cook recipe" action (consumes ingredients)
- [ ] Recipe suggestions based on inventory

**Deliverables**:
- Create recipes with ingredients
- Plan meals for the week
- Adjust portions
- Auto-consume when cooking

### Phase 4: Smart Shopping List
**Goal**: Intelligent shopping list generation

- [ ] Shopping list generation algorithm
- [ ] Calculate needs from meal plan
- [ ] Factor in current inventory
- [ ] Recommend package quantities
- [ ] Estimated costs
- [ ] Check off items while shopping
- [ ] Quick "add to inventory" from purchased items

**Deliverables**:
- Generate shopping list from meal plan
- See why each item is needed
- Estimated cost per item
- One-tap add to inventory after purchase

### Phase 5: Consumption Forecast
**Goal**: Predict needs for non-recipe items

- [ ] Consumption pattern analysis
- [ ] Average consumption rate calculation
- [ ] "Days remaining" prediction
- [ ] Include forecast items in shopping list
- [ ] Adjust forecast manually

**Deliverables**:
- See how long supplies will last
- Auto-add forecast items to shopping list
- Works for toiletries, cleaning supplies, etc.

### Phase 6: Barcode Scanner
**Goal**: Quick article lookup via camera

- [ ] Camera access + barcode scanning
- [ ] Article lookup by barcode
- [ ] Quick actions (consume, add purchase)
- [ ] Show related recipes
- [ ] Manual barcode entry fallback

**Deliverables**:
- Scan barcode → see article info
- Quick consume/add actions
- Works on mobile + tablet

### Phase 7: Nutrition & Costs
**Goal**: Track nutrition and spending

- [ ] Nutrition input per article
- [ ] Calculate recipe nutrition
- [ ] Daily/weekly nutrition summary
- [ ] Price tracking per batch
- [ ] Weekly spending overview
- [ ] Cost per recipe

**Deliverables**:
- See nutrition per meal/day/week
- Track spending over time
- Cost estimates for meal plan

### Phase 8: Polish & Optimization
**Goal**: Performance, UX, edge cases

- [ ] Offline mode improvements
- [ ] Performance optimization
- [ ] Bulk operations (multi-select)
- [ ] Data export/import
- [ ] Dark mode
- [ ] Keyboard shortcuts (desktop)
- [ ] Comprehensive error handling

---

## 5. API Specification

### Authentication
```
POST   /api/auth/login           { password }
POST   /api/auth/logout          -
POST   /api/auth/change-password { currentPassword, newPassword }
GET    /api/auth/check           → { authenticated: boolean }
```

### Storage Locations
```
GET    /api/locations            → Location[]
POST   /api/locations            { name, icon?, sortOrder? }
PUT    /api/locations/:id        { name?, icon?, sortOrder? }
DELETE /api/locations/:id
```

### Articles
```
GET    /api/articles             → Article[] (with totalStock, batches count)
GET    /api/articles/:id         → Article (with batches, recent consumption)
GET    /api/articles/barcode/:code → Article | null
POST   /api/articles             { name, barcode?, ... }
PUT    /api/articles/:id         { name?, barcode?, ... }
DELETE /api/articles/:id
GET    /api/articles/search?q=   → Article[] (name/barcode search)
GET    /api/articles/low-stock   → Article[] (below minStock)
GET    /api/articles/expiring?days=7 → Article[] (with expiring batches)
```

### Batches
```
GET    /api/batches              → Batch[] (optionally filter by articleId)
GET    /api/batches/:id          → Batch
POST   /api/batches              { articleId, quantity, purchaseDate?, expiryDate?, purchasePrice? }
PUT    /api/batches/:id          { quantity?, expiryDate?, notes? }
DELETE /api/batches/:id
POST   /api/batches/:id/consume  { quantity, source?, notes? }
POST   /api/articles/:id/consume { quantity, source?, notes? } → Auto-selects FIFO batch
```

### Consumption
```
GET    /api/consumption          → ConsumptionLog[] (filter by date range, articleId)
GET    /api/consumption/forecast/:articleId → { avgPerDay, daysRemaining, nextNeeded }
POST   /api/consumption          { articleId, quantity, source?, notes? }
```

### Recipes
```
GET    /api/recipes              → Recipe[]
GET    /api/recipes/:id          → Recipe (with ingredients, nutrition)
POST   /api/recipes              { name, servings, ingredients[], ... }
PUT    /api/recipes/:id          { name?, servings?, ingredients[]?, ... }
DELETE /api/recipes/:id
GET    /api/recipes/suggestions  → Recipe[] (based on available inventory)
POST   /api/recipes/:id/cook     { servings } → Consumes ingredients from inventory
```

### Meal Plan
```
GET    /api/meal-plan?from=&to=  → MealPlanEntry[]
POST   /api/meal-plan            { date, mealType, recipeId, servings }
PUT    /api/meal-plan/:id        { servings?, notes? }
DELETE /api/meal-plan/:id
POST   /api/meal-plan/:id/complete → Marks as completed, consumes ingredients
```

### Shopping List
```
GET    /api/shopping-lists       → ShoppingList[]
GET    /api/shopping-lists/:id   → ShoppingList (with items)
POST   /api/shopping-lists       { shopDate, planUntilDate } → Generates list
PUT    /api/shopping-lists/:id   { name?, status? }
DELETE /api/shopping-lists/:id
POST   /api/shopping-lists/:id/items     { articleId?, customName?, quantity }
PUT    /api/shopping-lists/:id/items/:itemId { isPurchased?, quantity?, price? }
DELETE /api/shopping-lists/:id/items/:itemId
POST   /api/shopping-lists/:id/checkout  → Adds purchased items to inventory
```

### Settings
```
GET    /api/settings             → AppSettings
PUT    /api/settings             { locale?, defaultShopDay?, currency? }
```

### Health
```
GET    /api/health               → { status: "ok", version: "x.x.x" }
```

---

## 6. UI/UX Design

### Color Palette
```css
/* Primary: Green (fresh/inventory theme) */
--primary-50:  #f0fdf4;
--primary-100: #dcfce7;
--primary-500: #22c55e;
--primary-600: #16a34a;
--primary-700: #15803d;

/* Status colors */
--danger:  #ef4444;  /* Expired, low stock */
--warning: #f59e0b;  /* Expiring soon */
--success: #22c55e;  /* In stock, fresh */
--info:    #3b82f6;  /* Informational */
```

### Navigation Structure
```
┌─────────────────────────────────────────────┐
│  Desktop: Top Navigation                     │
│  ┌─────┬───────┬─────────┬──────┬─────────┐ │
│  │ 🏠  │ 📦    │ 🍳      │ 🛒   │ ⚙️      │ │
│  │Home │Inventory│Recipes│Shop  │Settings │ │
│  └─────┴───────┴─────────┴──────┴─────────┘ │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Mobile: Bottom Navigation                   │
│                                             │
│  [    Main Content Area                   ] │
│                                             │
│  ┌─────┬───────┬─────────┬──────┬─────────┐ │
│  │ 🏠  │ 📦    │ 📷      │ 🛒   │ ≡       │ │
│  │Home │Invent.│ Scan    │Shop  │ More    │ │
│  └─────┴───────┴─────────┴──────┴─────────┘ │
└─────────────────────────────────────────────┘
```

### Page Layouts

#### Dashboard (Home)
```
┌─────────────────────────────────────────────┐
│  🏠 Dashboard                               │
├─────────────────────────────────────────────┤
│  ⚠️ Expiring Soon (3)              [View →] │
│  ┌─────────────────────────────────────────┐│
│  │ 🥛 Milk        │ Expires tomorrow       ││
│  │ 🥚 Eggs        │ Expires in 2 days      ││
│  │ 🧀 Cheese      │ Expires in 3 days      ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  📉 Low Stock (2)                  [View →] │
│  ┌─────────────────────────────────────────┐│
│  │ 🧻 Toilet Paper │ 2 rolls (min: 6)      ││
│  │ ☕ Coffee       │ 100g (min: 250g)      ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  🍽️ Today's Meals                          │
│  ┌─────────────────────────────────────────┐│
│  │ 🌅 Breakfast: -                         ││
│  │ 🌞 Lunch: Pasta Carbonara (2 servings)  ││
│  │ 🌙 Dinner: -                            ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  🛒 Shopping List                  [View →] │
│  │ Next shop: Saturday │ 12 items │ ~€45   ││
└─────────────────────────────────────────────┘
```

#### Inventory Page
```
┌─────────────────────────────────────────────┐
│  📦 Inventory                    [+ Add]    │
│  ┌─────────────────────────────────────────┐│
│  │ 🔍 Search articles...                   ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  📍 Fridge                           (12)   │
│  ┌───────────────────┬─────────────────────┐│
│  │ 🥛 Milk           │ 2L    │ ⚠️ Tomorrow ││
│  │ 🥚 Eggs           │ 8 pcs │ Jan 25      ││
│  │ 🧀 Cheese         │ 200g  │ Jan 23      ││
│  └───────────────────┴─────────────────────┘│
├─────────────────────────────────────────────┤
│  📍 Pantry                           (24)   │
│  ┌───────────────────┬─────────────────────┐│
│  │ 🍝 Pasta          │ 1kg   │ Jun 2026    ││
│  │ 🍚 Rice           │ 2kg   │ Dec 2026    ││
│  │ 🥫 Tomato Sauce   │ 3 jars│ Mar 2026    ││
│  └───────────────────┴─────────────────────┘│
├─────────────────────────────────────────────┤
│  📍 Bathroom                         (8)    │
│  ┌───────────────────┬─────────────────────┐│
│  │ 🧴 Shampoo        │ 1 btl │ ~30 days    ││
│  │ 🧼 Soap           │ 2 bars│ ~45 days    ││
│  └───────────────────┴─────────────────────┘│
└─────────────────────────────────────────────┘
```

#### Article Detail Page
```
┌─────────────────────────────────────────────┐
│  ← Back                                     │
├─────────────────────────────────────────────┤
│  🥛 Milk                          [Edit ✏️] │
│  ────────────────────────────────────────── │
│  Location: Fridge                           │
│  Package: 1L bottle                         │
│  Barcode: 4001234567890                     │
│  Total Stock: 2L (2 bottles)                │
├─────────────────────────────────────────────┤
│  📦 Batches                                 │
│  ┌─────────────────────────────────────────┐│
│  │ Batch 1          │ 1L    │ ⚠️ Jan 20   ││
│  │ Bought: Jan 15   │       │ [Consume]   ││
│  ├─────────────────────────────────────────┤│
│  │ Batch 2          │ 1L    │ Jan 25      ││
│  │ Bought: Jan 18   │       │ [Consume]   ││
│  └─────────────────────────────────────────┘│
│                              [+ Add Batch]  │
├─────────────────────────────────────────────┤
│  📊 Consumption (last 30 days)              │
│  Average: 0.5L / day                        │
│  Estimated days remaining: 4 days           │
├─────────────────────────────────────────────┤
│  🍳 Used in Recipes                         │
│  • Pancakes                                 │
│  • Scrambled Eggs                           │
│  • Smoothie                                 │
├─────────────────────────────────────────────┤
│  [🗑️ Delete Article]                       │
└─────────────────────────────────────────────┘
```

#### Shopping List Page
```
┌─────────────────────────────────────────────┐
│  🛒 Shopping List             [Regenerate]  │
│  ────────────────────────────────────────── │
│  Shop: Saturday, Jan 25                     │
│  Plan until: Saturday, Feb 1                │
│  Estimated total: €47.50                    │
├─────────────────────────────────────────────┤
│  📋 Items (12)                              │
│  ┌─────────────────────────────────────────┐│
│  │ ☐ Milk (2L)           │ €2.50  │ Recipe ││
│  │   → Pancakes, Smoothie                  ││
│  ├─────────────────────────────────────────┤│
│  │ ☐ Eggs (10 pcs)       │ €3.00  │ Recipe ││
│  │   → Pancakes, Scrambled Eggs            ││
│  ├─────────────────────────────────────────┤│
│  │ ☐ Toilet Paper (6 rolls)│ €4.00│ Low   ││
│  │   → Currently: 2 rolls (min: 6)         ││
│  ├─────────────────────────────────────────┤│
│  │ ☑ ~~Bread (1 loaf)~~  │ €2.50  │ Forecast│
│  │   → Avg. consumption: 1 loaf/week       ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  [+ Add Custom Item]                        │
│  [✓ Complete Shopping → Add to Inventory]   │
└─────────────────────────────────────────────┘
```

### Mobile Optimizations
- **Bottom navigation**: 5 items max, center item for scanner
- **Pull to refresh**: On list pages
- **Swipe actions**: Swipe left to consume, right to add batch
- **Large touch targets**: Min 44x44px
- **Safe area insets**: Avoid notch/home indicator
- **Haptic feedback**: On successful actions (where supported)

### Quick Actions (Bottom Sheet)
```
┌─────────────────────────────────────────────┐
│  🥛 Milk                                    │
│  ─────────────────────────────────────────  │
│  [➖ Consume 1]     [➖ Consume 0.5L]       │
│  [➕ Add Purchase]                          │
│  [📝 Edit Article]                          │
│  [📊 View Details]                          │
│  ─────────────────────────────────────────  │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
```

---

## 7. Implementation Checklist

### Phase 1: Foundation
```
[ ] Project Setup
    [ ] Initialize monorepo structure
    [ ] Configure TypeScript
    [ ] Setup Vite for web package
    [ ] Setup Fastify for api package
    [ ] Configure Tailwind CSS
    [ ] Setup ESLint + Prettier

[ ] Database
    [ ] Create Prisma schema
    [ ] Generate Prisma client
    [ ] Create seed data script

[ ] Authentication
    [ ] Implement password hashing (SHA256 + salt)
    [ ] Create auth routes (login, logout, check)
    [ ] Setup Fastify session
    [ ] Create AuthContext for frontend
    [ ] Create LoginPage
    [ ] Add protected route wrapper

[ ] Storage Locations
    [ ] Create location routes (CRUD)
    [ ] Create LocationList component
    [ ] Create LocationEditModal

[ ] Articles
    [ ] Create article routes (CRUD)
    [ ] Create ArticleCard component
    [ ] Create InventoryPage
    [ ] Create ArticleDetailPage
    [ ] Create ArticleEditPage
    [ ] Implement barcode field

[ ] Batches
    [ ] Create batch routes (CRUD + consume)
    [ ] Create BatchList component
    [ ] Create AddBatchModal
    [ ] Create ConsumeModal
    [ ] Implement FIFO auto-selection

[ ] PWA Setup
    [ ] Configure vite-plugin-pwa
    [ ] Create manifest.json
    [ ] Generate app icons (all sizes)
    [ ] Configure service worker caching

[ ] i18n
    [ ] Create translation files (en.yaml, de.yaml)
    [ ] Create LocaleContext
    [ ] Create useTranslation hook
    [ ] Add language selector in settings

[ ] Docker
    [ ] Create Dockerfile (multi-stage)
    [ ] Create docker-compose.yml
    [ ] Create .env.example
```

### Phase 2: Expiry & Consumption
```
[ ] Expiry System
    [ ] Add expiry calculation logic
    [ ] Create ExpiryWarning component
    [ ] Add expiry filter to inventory
    [ ] Create expiring items API endpoint

[ ] Dashboard
    [ ] Create DashboardPage
    [ ] Add expiring soon section
    [ ] Add low stock section
    [ ] Add today's meals preview

[ ] Consumption
    [ ] Create consumption log routes
    [ ] Create ConsumptionHistory component
    [ ] Track consumption source (manual/recipe/expired)
    [ ] Create consumption stats view

[ ] Inventory Correction
    [ ] Add batch quantity adjustment
    [ ] Create inventory audit mode
```

### Phase 3: Recipes & Meal Planning
```
[ ] Recipes
    [ ] Create recipe routes (CRUD)
    [ ] Create RecipesPage (list)
    [ ] Create RecipeDetailPage
    [ ] Create RecipeEditPage
    [ ] Create RecipeIngredient management
    [ ] Implement flexible ingredients (category match)

[ ] Meal Planning
    [ ] Create meal plan routes
    [ ] Create MealPlanPage (calendar view)
    [ ] Create MealPlanDayView
    [ ] Create AddMealModal
    [ ] Implement portion adjustment

[ ] Cook Action
    [ ] Create "cook recipe" endpoint
    [ ] Calculate ingredient needs
    [ ] Auto-consume from inventory
    [ ] Handle missing ingredients warning
```

### Phase 4: Smart Shopping List
```
[ ] Shopping List Generation
    [ ] Create shopping calculation logic
    [ ] Factor in meal plan needs
    [ ] Factor in current inventory
    [ ] Factor in minimum stock levels
    [ ] Calculate recommended package quantities

[ ] Shopping List UI
    [ ] Create ShoppingListPage
    [ ] Create ShoppingItem component
    [ ] Show "why needed" reason
    [ ] Group by category/store section

[ ] Checkout Flow
    [ ] Check off items while shopping
    [ ] Record actual prices
    [ ] "Complete shopping" action
    [ ] Auto-create batches from purchases
```

### Phase 5: Consumption Forecast
```
[ ] Forecast Algorithm
    [ ] Calculate consumption rate from logs
    [ ] Predict days until empty
    [ ] Handle irregular consumption patterns

[ ] Forecast UI
    [ ] Show forecast on article detail
    [ ] Add forecast column to inventory
    [ ] Include forecast items in shopping list

[ ] Manual Adjustments
    [ ] Allow overriding forecast rate
    [ ] Set forecast period preferences
```

### Phase 6: Barcode Scanner
```
[ ] Scanner Implementation
    [ ] Integrate barcode scanning library
    [ ] Create ScanPage with camera view
    [ ] Handle permissions
    [ ] Manual barcode entry fallback

[ ] Post-Scan Actions
    [ ] Article lookup by barcode
    [ ] Quick consume action
    [ ] Quick add batch action
    [ ] Show related recipes
    [ ] Handle unknown barcodes (create article)
```

### Phase 7: Nutrition & Costs
```
[ ] Nutrition
    [ ] Add nutrition fields to article edit
    [ ] Calculate recipe nutrition
    [ ] Create NutritionSummary component
    [ ] Show daily/weekly nutrition on dashboard

[ ] Costs
    [ ] Track prices on batches
    [ ] Calculate recipe costs
    [ ] Show weekly spending summary
    [ ] Cost estimates on shopping list
```

### Phase 8: Polish
```
[ ] Offline Improvements
    [ ] Queue offline changes
    [ ] Sync when back online
    [ ] Clear offline indicator

[ ] Performance
    [ ] Lazy load pages
    [ ] Optimize large lists (virtualization)
    [ ] Image optimization

[ ] UX Enhancements
    [ ] Pull to refresh
    [ ] Swipe actions
    [ ] Keyboard shortcuts
    [ ] Bulk operations

[ ] Data Management
    [ ] Export data (JSON)
    [ ] Import data
    [ ] Reset/clear data

[ ] Theming
    [ ] Dark mode support
    [ ] System theme detection
```

---

## Appendix A: Key Algorithms

### FIFO Consumption
```typescript
// Consume from oldest batch first
async function consumeFromArticle(articleId: string, quantity: number) {
  const batches = await prisma.batch.findMany({
    where: { articleId, quantity: { gt: 0 } },
    orderBy: [
      { expiryDate: 'asc' },    // Expiring first
      { purchaseDate: 'asc' },  // Then oldest
    ],
  });

  let remaining = quantity;
  const logs = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const toConsume = Math.min(batch.quantity, remaining);
    await prisma.batch.update({
      where: { id: batch.id },
      data: { quantity: batch.quantity - toConsume },
    });

    logs.push({ batchId: batch.id, quantity: toConsume });
    remaining -= toConsume;
  }

  // Create consumption logs
  for (const log of logs) {
    await prisma.consumptionLog.create({
      data: { articleId, ...log, source: 'MANUAL' },
    });
  }

  return { consumed: quantity - remaining, logs };
}
```

### Shopping List Generation
```typescript
async function generateShoppingList(shopDate: Date, planUntilDate: Date) {
  // 1. Get meal plan for period
  const meals = await getMealPlan(shopDate, planUntilDate);

  // 2. Calculate ingredient needs
  const needs = new Map<string, { quantity: number; reasons: string[] }>();
  for (const meal of meals) {
    const recipe = await getRecipeWithIngredients(meal.recipeId);
    const multiplier = meal.servings / recipe.servings;

    for (const ing of recipe.ingredients) {
      const articleId = ing.articleId || await findByCategory(ing.categoryMatch);
      const current = needs.get(articleId) || { quantity: 0, reasons: [] };
      current.quantity += ing.quantity * multiplier;
      current.reasons.push(`Recipe: ${recipe.name}`);
      needs.set(articleId, current);
    }
  }

  // 3. Add low stock items
  const lowStock = await getLowStockArticles();
  for (const article of lowStock) {
    const current = needs.get(article.id) || { quantity: 0, reasons: [] };
    current.quantity = Math.max(current.quantity, article.minStock - article.currentStock);
    current.reasons.push('Low stock');
    needs.set(article.id, current);
  }

  // 4. Add forecast items
  const forecast = await getForecastNeeds(shopDate, planUntilDate);
  for (const item of forecast) {
    const current = needs.get(item.articleId) || { quantity: 0, reasons: [] };
    current.quantity += item.predictedNeed;
    current.reasons.push(`Forecast: ~${item.avgPerDay}/day`);
    needs.set(item.articleId, current);
  }

  // 5. Subtract current inventory
  const items = [];
  for (const [articleId, need] of needs) {
    const article = await getArticle(articleId);
    const currentStock = await getTotalStock(articleId);
    const toBuy = Math.max(0, need.quantity - currentStock);

    if (toBuy > 0) {
      const packs = Math.ceil(toBuy / article.packageSize);
      items.push({
        articleId,
        neededQuantity: toBuy,
        recommendedPacks: packs,
        estimatedPrice: packs * (article.avgPrice || 0),
        reason: need.reasons[0],
        reasonDetails: need.reasons.join(', '),
      });
    }
  }

  return items;
}
```

### Consumption Forecast
```typescript
async function getConsumptionForecast(articleId: string) {
  // Get last 30 days of consumption
  const logs = await prisma.consumptionLog.findMany({
    where: {
      articleId,
      consumedAt: { gte: subDays(new Date(), 30) },
    },
  });

  const totalConsumed = logs.reduce((sum, log) => sum + log.quantity, 0);
  const avgPerDay = totalConsumed / 30;

  const currentStock = await getTotalStock(articleId);
  const daysRemaining = avgPerDay > 0 ? currentStock / avgPerDay : Infinity;

  return {
    avgPerDay,
    avgPerWeek: avgPerDay * 7,
    daysRemaining: Math.floor(daysRemaining),
    nextNeeded: addDays(new Date(), daysRemaining),
  };
}
```

---

## Appendix B: Translation Keys Structure

```yaml
# en.yaml / de.yaml structure
common:
  save: Save
  cancel: Cancel
  delete: Delete
  edit: Edit
  add: Add
  search: Search
  loading: Loading...
  error: Error
  retry: Retry
  confirm: Confirm

nav:
  dashboard: Dashboard
  inventory: Inventory
  recipes: Recipes
  mealPlan: Meal Plan
  shopping: Shopping
  scan: Scan
  settings: Settings

dashboard:
  title: Dashboard
  expiringSoon: Expiring Soon
  lowStock: Low Stock
  todaysMeals: Today's Meals
  shoppingPreview: Shopping List
  noExpiring: Nothing expiring soon
  noLowStock: All items well stocked

inventory:
  title: Inventory
  addArticle: Add Article
  searchPlaceholder: Search articles...
  totalItems: "{count} items"
  emptyLocation: No items in this location

article:
  name: Name
  barcode: Barcode
  location: Location
  packageSize: Package Size
  unit: Unit
  minStock: Minimum Stock
  expiryDefault: Default Expiry (days)
  batches: Batches
  addBatch: Add Purchase
  consume: Consume

batch:
  quantity: Quantity
  purchaseDate: Purchase Date
  expiryDate: Expiry Date
  price: Price
  expires: "Expires {date}"
  expired: Expired
  expiresIn: "Expires in {days} days"

recipe:
  title: Recipes
  servings: Servings
  prepTime: Prep Time
  cookTime: Cook Time
  ingredients: Ingredients
  instructions: Instructions
  cook: Cook Now

mealPlan:
  title: Meal Plan
  breakfast: Breakfast
  lunch: Lunch
  dinner: Dinner
  snack: Snack
  addMeal: Add Meal

shopping:
  title: Shopping List
  shopDate: Shopping Date
  planUntil: Plan Until
  estimatedTotal: "Estimated Total: {amount}"
  generateList: Generate List
  completeShop: Complete Shopping
  itemReason:
    recipe: For recipe
    lowStock: Low stock
    forecast: Predicted need
    manual: Added manually

settings:
  title: Settings
  language: Language
  password: App Password
  changePassword: Change Password
  defaultShopDay: Default Shopping Day
  currency: Currency
```

---

## Next Steps

1. **Start with Phase 1** - Get the foundation working
2. **Test early, test often** - Manual testing on mobile/tablet/desktop
3. **Iterate based on usage** - The best features come from real use
4. **Keep it simple** - Resist feature creep, focus on core value

---

*Last updated: January 2026*
*Based on TickForge architecture v1.0*