import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { ensureDatabase, prisma } from './lib/db.js';
import { initializeAuth } from './lib/auth.js';
import { authRoutes } from './routes/auth.js';
import { settingsRoutes } from './routes/settings.js';
import { locationRoutes } from './routes/locations.js';
import { articleRoutes } from './routes/articles.js';
import { batchRoutes } from './routes/batches.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { recipeRoutes } from './routes/recipes.js';
import { mealPlanRoutes } from './routes/mealplan.js';
import { shoppingRoutes } from './routes/shopping.js';
import { forecastRoutes } from './routes/forecast.js';
import { productRoutes } from './routes/products.js';
import { consumptionRoutes } from './routes/consumption.js';
import { unitsRoutes } from './routes/units.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.APP_PORT || '3000', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-please-32-chars';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Cookie & Session
  await fastify.register(cookie);
  await fastify.register(session, {
    secret: SESSION_SECRET.padEnd(32, '0').slice(0, 32),
    cookie: {
      secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    saveUninitialized: false,
  });

  // Auth middleware for API routes (except auth routes)
  fastify.addHook('preHandler', async (request, reply) => {
    const url = request.url;

    // Skip auth for these routes
    if (
      url.startsWith('/api/auth/') ||
      url === '/api/health' ||
      url === '/api/settings' && request.method === 'GET' ||
      !url.startsWith('/api/')
    ) {
      return;
    }

    const authenticated = (request.session as any).authenticated === true;
    if (!authenticated) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
  });

  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' };
  });

  // API Routes
  await fastify.register(async (api) => {
    await api.register(authRoutes);
    await api.register(settingsRoutes);
    await api.register(locationRoutes);
    await api.register(articleRoutes);
    await api.register(batchRoutes);
    await api.register(dashboardRoutes);
    await api.register(recipeRoutes);
    await api.register(mealPlanRoutes);
    await api.register(shoppingRoutes);
    await api.register(forecastRoutes);
    await api.register(productRoutes);
    await api.register(consumptionRoutes);
    await api.register(unitsRoutes);
  }, { prefix: '/api' });

  // Serve static frontend files in production
  const webDistPath = join(__dirname, '../../web/dist');
  if (existsSync(webDistPath)) {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA fallback
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return fastify;
}

async function main() {
  try {
    // Initialize database
    await ensureDatabase();

    // Initialize auth (create default password if not exists)
    await initializeAuth();

    // Build and start server
    const fastify = await buildServer();

    // Start server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Vorratio API running on http://0.0.0.0:${PORT}`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();
