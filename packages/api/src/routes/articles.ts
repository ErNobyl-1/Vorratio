import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';
import { addDays, startOfDay, endOfDay } from 'date-fns';

const CreateArticleSchema = z.object({
  name: z.string().min(1).max(200),
  defaultUnit: z.string().max(20).default('pcs'),
  packageSize: z.number().positive().default(1),
  packageUnit: z.string().max(20).default('pcs'),
  locationId: z.string().uuid().optional().nullable(),
  minStock: z.number().nonnegative().optional().nullable(),
  defaultExpiryDays: z.number().int().positive().optional().nullable(),
  calories: z.number().nonnegative().optional().nullable(),
  protein: z.number().nonnegative().optional().nullable(),
  carbs: z.number().nonnegative().optional().nullable(),
  fat: z.number().nonnegative().optional().nullable(),
  fiber: z.number().nonnegative().optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  isConsumable: z.boolean().default(true),
});

const UpdateArticleSchema = CreateArticleSchema.partial();

export async function articleRoutes(fastify: FastifyInstance) {
  // Get all articles with stock info
  fastify.get('/articles', async (request: FastifyRequest<{
    Querystring: { locationId?: string; category?: string; search?: string; lowStock?: string }
  }>, reply: FastifyReply) => {
    const { locationId, category, search, lowStock } = request.query;

    const articles = await prisma.article.findMany({
      where: {
        ...(locationId && { locationId }),
        ...(category && { category }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { products: { some: { barcode: { contains: search } } } },
            { products: { some: { name: { contains: search } } } },
          ],
        }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        location: true,
        batches: {
          where: { quantity: { gt: 0 } },
          orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
        },
        products: true,
      },
    });

    // Calculate total stock and earliest expiry for each article
    const result = articles.map((article: typeof articles[number]) => {
      const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);
      const earliestExpiry = article.batches.find((b: { expiryDate: Date | null }) => b.expiryDate)?.expiryDate;
      const batchCount = article.batches.length;

      return {
        ...article,
        totalStock,
        earliestExpiry,
        batchCount,
        isLowStock: article.minStock ? totalStock < article.minStock : false,
      };
    });

    // Filter low stock if requested
    if (lowStock === 'true') {
      return result.filter((a: { isLowStock: boolean }) => a.isLowStock);
    }

    return result;
  });

  // Get articles expiring soon
  fastify.get('/articles/expiring', async (request: FastifyRequest<{
    Querystring: { days?: string }
  }>, reply: FastifyReply) => {
    const days = parseInt(request.query.days || '7', 10);
    const endDate = endOfDay(addDays(new Date(), days));

    const batches = await prisma.batch.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { lte: endDate },
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        article: {
          include: { location: true },
        },
      },
    });

    return batches;
  });

  // Get single article with details
  fastify.get('/articles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        location: true,
        batches: {
          where: { quantity: { gt: 0 } },
          orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
        },
        consumptionLogs: {
          orderBy: { consumedAt: 'desc' },
          take: 50,
        },
        recipeIngredients: {
          include: {
            recipe: {
              select: { id: true, name: true },
            },
          },
        },
        products: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!article) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    // Get all batches (including depleted ones) for history
    const allBatches = await prisma.batch.findMany({
      where: { articleId: id },
      orderBy: { purchaseDate: 'desc' },
      take: 50,
    });

    const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);

    // Calculate price per unit (purchasePrice / initialQuantity)
    // This gives us a comparable price regardless of how many units were purchased
    const batchesWithPrice = allBatches.filter(
      (b: { purchasePrice: number | null; initialQuantity: number }) =>
        b.purchasePrice !== null && b.initialQuantity > 0
    );

    // Last purchase price per unit
    const lastPricePerUnit = batchesWithPrice.length > 0
      ? batchesWithPrice[0].purchasePrice! / batchesWithPrice[0].initialQuantity
      : null;

    // Average price per unit (weighted by quantity purchased)
    let avgPricePerUnit: number | null = null;
    if (batchesWithPrice.length > 0) {
      const totalSpent = batchesWithPrice.reduce(
        (sum: number, b: { purchasePrice: number | null }) => sum + (b.purchasePrice || 0),
        0
      );
      const totalQuantityPurchased = batchesWithPrice.reduce(
        (sum: number, b: { initialQuantity: number }) => sum + b.initialQuantity,
        0
      );
      avgPricePerUnit = totalQuantityPurchased > 0 ? totalSpent / totalQuantityPurchased : null;
    }

    return {
      ...article,
      totalStock,
      isLowStock: article.minStock ? totalStock < article.minStock : false,
      allBatches, // All batches for purchase history
      lastPurchasePrice: lastPricePerUnit,
      avgPrice: avgPricePerUnit,
    };
  });

  // Get article by barcode (searches in products)
  fastify.get('/articles/barcode/:barcode', async (request: FastifyRequest<{ Params: { barcode: string } }>, reply: FastifyReply) => {
    const { barcode } = request.params;

    // First, find the product with this barcode
    const product = await prisma.product.findUnique({
      where: { barcode },
      include: {
        article: {
          include: {
            location: true,
            batches: {
              where: { quantity: { gt: 0 } },
              orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
            },
            recipeIngredients: {
              include: {
                recipe: {
                  select: { id: true, name: true },
                },
              },
            },
            products: {
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    const article = product.article;
    const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);

    return {
      ...article,
      totalStock,
      isLowStock: article.minStock ? totalStock < article.minStock : false,
      matchedProduct: product, // Include which product matched the barcode
    };
  });

  // Create article
  fastify.post('/articles', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateArticleSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;

    // Get max sortOrder
    const maxOrder = await prisma.article.aggregate({
      _max: { sortOrder: true },
    });

    const article = await prisma.article.create({
      data: {
        ...data,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { location: true },
    });

    return reply.status(201).send(article);
  });

  // Update article
  fastify.put('/articles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateArticleSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;

    try {
      const article = await prisma.article.update({
        where: { id },
        data,
        include: { location: true },
      });

      return article;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Article not found' });
      }
      throw error;
    }
  });

  // Delete article
  fastify.delete('/articles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.article.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Article not found' });
      }
      throw error;
    }
  });

  // Consume from article (auto-selects FIFO batch)
  fastify.post('/articles/:id/consume', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { quantity: number; source?: string; notes?: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { quantity, source = 'MANUAL', notes } = request.body as any;

    if (!quantity || quantity <= 0) {
      return reply.status(400).send({ error: 'Quantity must be positive' });
    }

    // Get batches ordered by FIFO (expiry first, then purchase date)
    const batches = await prisma.batch.findMany({
      where: {
        articleId: id,
        quantity: { gt: 0 },
      },
      orderBy: [
        { expiryDate: 'asc' },
        { purchaseDate: 'asc' },
      ],
    });

    if (batches.length === 0) {
      return reply.status(400).send({ error: 'No stock available' });
    }

    let remaining = quantity;
    const consumptionLogs = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const toConsume = Math.min(batch.quantity, remaining);

      await prisma.batch.update({
        where: { id: batch.id },
        data: { quantity: batch.quantity - toConsume },
      });

      const log = await prisma.consumptionLog.create({
        data: {
          articleId: id,
          batchId: batch.id,
          quantity: toConsume,
          source,
          notes,
        },
      });

      consumptionLogs.push(log);
      remaining -= toConsume;
    }

    return {
      consumed: quantity - remaining,
      remaining,
      logs: consumptionLogs,
    };
  });

  // Stock correction - adjust total stock to actual value
  fastify.post('/articles/:id/correct-stock', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { actualStock: number; notes?: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { actualStock, notes } = request.body as any;

    if (actualStock === undefined || actualStock < 0) {
      return reply.status(400).send({ error: 'actualStock must be a non-negative number' });
    }

    // Get current total stock
    const batches = await prisma.batch.findMany({
      where: {
        articleId: id,
        quantity: { gt: 0 },
      },
      orderBy: [
        { expiryDate: 'asc' },
        { purchaseDate: 'asc' },
      ],
    });

    const currentStock = batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);
    const difference = actualStock - currentStock;

    if (difference === 0) {
      return { message: 'Stock already matches', currentStock, actualStock };
    }

    if (difference > 0) {
      // Need to add stock - create a new batch with the difference
      const newBatch = await prisma.batch.create({
        data: {
          articleId: id,
          quantity: difference,
          initialQuantity: difference,
          purchaseDate: new Date(),
          notes: notes || 'Stock correction (added)',
        },
      });

      // Log this as a correction
      await prisma.consumptionLog.create({
        data: {
          articleId: id,
          batchId: newBatch.id,
          quantity: -difference, // Negative to indicate addition
          source: 'CORRECTION',
          notes: notes || `Stock corrected from ${currentStock} to ${actualStock}`,
        },
      });

      return {
        message: 'Stock increased',
        previousStock: currentStock,
        newStock: actualStock,
        difference,
      };
    } else {
      // Need to reduce stock - consume from batches FIFO
      let remaining = Math.abs(difference);
      const consumptionLogs = [];

      for (const batch of batches) {
        if (remaining <= 0) break;

        const toConsume = Math.min(batch.quantity, remaining);

        await prisma.batch.update({
          where: { id: batch.id },
          data: { quantity: batch.quantity - toConsume },
        });

        const log = await prisma.consumptionLog.create({
          data: {
            articleId: id,
            batchId: batch.id,
            quantity: toConsume,
            source: 'CORRECTION',
            notes: notes || `Stock corrected from ${currentStock} to ${actualStock}`,
          },
        });

        consumptionLogs.push(log);
        remaining -= toConsume;
      }

      return {
        message: 'Stock decreased',
        previousStock: currentStock,
        newStock: actualStock,
        difference,
        logs: consumptionLogs,
      };
    }
  });
}
