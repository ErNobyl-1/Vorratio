# Vorratio

> **Vorratio** - Smart home inventory management. Track what you have, what you consume, and what you need to buy.

A private, offline-capable PWA for managing your household inventory. No cloud, no accounts, just your data.

## Features

- **Inventory Management**: Track articles with batch-based stock (purchase date, expiry date, quantity)
- **Expiry Warnings**: See what's expiring soon and what's already expired
- **Low Stock Alerts**: Get notified when items fall below minimum stock levels
- **FIFO Consumption**: Automatically consume oldest batches first
- **Barcode Support**: Quickly find articles by scanning/entering barcodes
- **Storage Locations**: Organize inventory by fridge, pantry, bathroom, etc.
- **Nutrition Tracking**: Optional nutrition data per article
- **Multi-language**: English and German support
- **Offline-capable**: Works without internet (PWA with service worker caching)
- **Mobile-first**: Optimized for phones, tablets, and desktops

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Fastify, Prisma ORM |
| Database | SQLite (self-contained) |
| PWA | vite-plugin-pwa, Workbox |
| Auth | Session-based with app password |
| i18n | Custom YAML-based |
| Deployment | Docker (GHCR) |

## Quick Start

### Using Docker (Recommended)

The Docker image is automatically built and published to GitHub Container Registry on every push to `main`.

1. Create a directory for your deployment:
   ```bash
   mkdir vorratio && cd vorratio
   ```

2. Download the docker-compose file:
   ```bash
   curl -O https://raw.githubusercontent.com/ErNobyl-1/Vorratio/main/docker-compose.yml
   ```

3. Create a `.env` file with your configuration:
   ```bash
   cat > .env << EOF
   APP_PORT=8124
   AUTH_PASSWORD=your-secure-password
   SESSION_SECRET=$(openssl rand -hex 32)
   DEFAULT_LOCALE=en
   EOF
   ```

4. Start the container:
   ```bash
   docker compose up -d
   ```

5. Open http://localhost:8124 in your browser

### Updating

To update to the latest version:
```bash
docker compose pull
docker compose up -d
```

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ErNobyl-1/Vorratio.git
   cd Vorratio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   # Set DATABASE_URL=file:./dev.db for local development
   ```

4. Initialize database:
   ```bash
   npm run db:push
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

   This starts both the API (port 3000) and web frontend (port 5173).

6. Open http://localhost:5173 in your browser

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Port for the application | `8124` |
| `AUTH_PASSWORD` | Initial app password | `changeme` |
| `SESSION_SECRET` | Secret for session encryption | (required) |
| `DEFAULT_LOCALE` | Default language (`en` or `de`) | `en` |
| `TZ` | Timezone | `Europe/Berlin` |
| `DATABASE_URL` | SQLite database path | (set by Docker) |

## Project Structure

```
Vorratio/
├── packages/
│   ├── api/          # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts       # Server entry
│   │   │   ├── lib/           # Auth, DB utilities
│   │   │   └── routes/        # API endpoints
│   │   └── prisma/
│   │       └── schema.prisma  # Database schema
│   │
│   └── web/          # React frontend
│       ├── src/
│       │   ├── components/    # Reusable components
│       │   ├── pages/         # Page components
│       │   ├── context/       # React contexts
│       │   ├── i18n/          # Translations
│       │   └── lib/           # API client, hooks
│       └── public/            # Static assets
│
├── .github/
│   └── workflows/
│       └── build-and-push.yml  # CI/CD pipeline
├── docker-compose.yml
├── Dockerfile
└── PLAN.md           # Development roadmap
```

## CI/CD

The project uses GitHub Actions for continuous integration and deployment:

- **Trigger**: Every push to the `main` branch
- **Build**: Multi-stage Docker build
- **Registry**: GitHub Container Registry (ghcr.io)
- **Tags**: `latest` and commit SHA

The workflow automatically builds and pushes the Docker image, so you always get the latest version with `docker compose pull`.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/change-password` - Change password

### Locations
- `GET /api/locations` - List all storage locations
- `POST /api/locations` - Create location
- `PUT /api/locations/:id` - Update location
- `DELETE /api/locations/:id` - Delete location

### Articles
- `GET /api/articles` - List articles (with stock info)
- `GET /api/articles/:id` - Get article details
- `GET /api/articles/barcode/:code` - Find by barcode
- `GET /api/articles/expiring?days=7` - Get expiring articles
- `POST /api/articles` - Create article
- `PUT /api/articles/:id` - Update article
- `DELETE /api/articles/:id` - Delete article
- `POST /api/articles/:id/consume` - Consume from article (FIFO)

### Batches
- `GET /api/batches` - List batches
- `POST /api/batches` - Add purchase batch
- `PUT /api/batches/:id` - Update batch
- `DELETE /api/batches/:id` - Delete batch
- `POST /api/batches/:id/consume` - Consume from specific batch

### Dashboard
- `GET /api/dashboard` - Get dashboard data (stats, expiring, low stock)

### Settings
- `GET /api/settings` - Get app settings
- `PUT /api/settings` - Update settings

## Roadmap

See [PLAN.md](PLAN.md) for the detailed development roadmap.

### Completed (Phase 1)
- Core inventory management
- Batch tracking with FIFO consumption
- Expiry and low stock warnings
- PWA with offline support
- i18n (EN/DE)

### Coming Soon
- Recipes & meal planning
- Smart shopping list generation
- Consumption forecasting
- Barcode camera scanning
- Nutrition summaries

## License

MIT

## Contributing

Contributions are welcome! Please read the development plan in [PLAN.md](PLAN.md) before starting work on new features.
