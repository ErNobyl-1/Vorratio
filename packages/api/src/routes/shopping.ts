import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { getForecastedShoppingItems } from '../lib/forecast.js';

const CreateShoppingListSchema = z.object({
  name: z.string().max(200).optional(),
  shopDate: z.string().datetime(),
  planUntil: z.string().datetime(),
});

const AddItemSchema = z.object({
  articleId: z.string().uuid().optional(),
  customName: z.string().max(200).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(20),
  reason: z.enum(['RECIPE', 'LOW_STOCK', 'FORECAST', 'MANUAL']),
  estimatedPrice: z.number().optional().nullable(),
});

export async function shoppingRoutes(fastify: FastifyInstance) {
  // Get all shopping lists
  fastify.get('/shopping-lists', async (request: FastifyRequest, reply: FastifyReply) => {
    const lists = await prisma.shoppingList.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return lists.map((list: typeof lists[number]) => ({
      ...list,
      totalItems: list._count.items,
    }));
  });

  // Get active shopping list (most recent non-completed)
  fastify.get('/shopping-lists/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const list = await prisma.shoppingList.findFirst({
      where: { completedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            article: {
              select: { id: true, name: true, defaultUnit: true, category: true },
            },
          },
          orderBy: [{ isPurchased: 'asc' }, { article: { category: 'asc' } }],
        },
      },
    });

    if (!list) {
      return reply.status(404).send({ error: 'No active shopping list' });
    }

    const totalItems = list.items.length;
    const purchasedItems = list.items.filter((i) => i.isPurchased).length;
    const estimatedTotal = list.items.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);

    // Map to frontend expected format
    return {
      id: list.id,
      name: list.name,
      shopDate: list.shopDate,
      planUntil: list.planUntilDate,
      completedAt: list.completedAt,
      createdAt: list.createdAt,
      items: list.items.map((item) => ({
        id: item.id,
        shoppingListId: item.listId,
        articleId: item.articleId,
        article: item.article,
        customName: item.customName,
        quantity: item.neededQuantity,
        purchasedQuantity: item.purchasedQuantity,
        unit: item.article?.defaultUnit || 'pcs',
        reason: item.reason,
        estimatedPrice: item.estimatedPrice,
        actualPrice: item.actualPrice,
        purchaseDate: item.purchaseDate,
        expiryDate: item.expiryDate,
        purchased: item.isPurchased,
        purchasedAt: null,
        createdAt: list.createdAt,
      })),
      totalItems,
      purchasedItems,
      estimatedTotal,
    };
  });

  // Get single shopping list
  fastify.get('/shopping-lists/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const list = await prisma.shoppingList.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            article: {
              select: { id: true, name: true, defaultUnit: true, category: true },
            },
          },
          orderBy: [{ isPurchased: 'asc' }, { article: { category: 'asc' } }],
        },
      },
    });

    if (!list) {
      return reply.status(404).send({ error: 'Shopping list not found' });
    }

    const totalItems = list.items.length;
    const purchasedItems = list.items.filter((i) => i.isPurchased).length;
    const estimatedTotal = list.items.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);

    // Map to frontend expected format
    return {
      id: list.id,
      name: list.name,
      shopDate: list.shopDate,
      planUntil: list.planUntilDate,
      completedAt: list.completedAt,
      createdAt: list.createdAt,
      items: list.items.map((item) => ({
        id: item.id,
        shoppingListId: item.listId,
        articleId: item.articleId,
        article: item.article,
        customName: item.customName,
        quantity: item.neededQuantity,
        purchasedQuantity: item.purchasedQuantity,
        unit: item.article?.defaultUnit || 'pcs',
        reason: item.reason,
        estimatedPrice: item.estimatedPrice,
        actualPrice: item.actualPrice,
        purchaseDate: item.purchaseDate,
        expiryDate: item.expiryDate,
        purchased: item.isPurchased,
        purchasedAt: null,
        createdAt: list.createdAt,
      })),
      totalItems,
      purchasedItems,
      estimatedTotal,
    };
  });

  // Generate a new shopping list based on meal plan and inventory
  fastify.post('/shopping-lists/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateShoppingListSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { name, shopDate, planUntil } = parseResult.data;
    const shopDateParsed = startOfDay(parseISO(shopDate));
    const planUntilParsed = endOfDay(parseISO(planUntil));

    // 1. Get all meal plan entries in the date range
    const mealEntries = await prisma.mealPlanEntry.findMany({
      where: {
        date: { gte: shopDateParsed, lte: planUntilParsed },
        completedAt: null,
      },
      include: {
        recipe: {
          include: {
            ingredients: {
              include: {
                article: {
                  select: { id: true, name: true, defaultUnit: true },
                },
              },
            },
          },
        },
      },
    });

    // 2. Calculate required ingredients from meal plan
    const requiredIngredients = new Map<string, {
      articleId: string | null;
      articleName: string | null;
      categoryMatch: string | null;
      unit: string;
      totalQuantity: number;
      reason: string;
    }>();

    for (const entry of mealEntries) {
      const portionMultiplier = entry.servings / entry.recipe.servings;

      for (const ing of entry.recipe.ingredients) {
        const key = ing.articleId || ing.categoryMatch || `unknown-${ing.id}`;
        const existing = requiredIngredients.get(key);
        const neededQuantity = ing.quantity * portionMultiplier;

        if (existing) {
          existing.totalQuantity += neededQuantity;
        } else {
          requiredIngredients.set(key, {
            articleId: ing.articleId,
            articleName: ing.article?.name || null,
            categoryMatch: ing.categoryMatch,
            unit: ing.unit,
            totalQuantity: neededQuantity,
            reason: 'RECIPE',
          });
        }
      }
    }

    // 3. Get current inventory levels for required articles
    const articleIds = Array.from(requiredIngredients.values())
      .map((i) => i.articleId)
      .filter((id): id is string => id !== null);

    const articlesWithStock = await prisma.article.findMany({
      where: { id: { in: articleIds } },
      include: {
        batches: {
          where: { quantity: { gt: 0 } },
        },
      },
    });

    const stockMap = new Map<string, number>();
    for (const article of articlesWithStock) {
      const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);
      stockMap.set(article.id, totalStock);
    }

    // 4. Get forecasted consumption for consumable articles
    const forecastedItems = await getForecastedShoppingItems(shopDateParsed, planUntilParsed);
    const forecastMap = new Map<string, number>();
    for (const item of forecastedItems) {
      forecastMap.set(item.articleId, item.quantity);
    }

    // 5. Get all articles with minStock to include in calculation
    const allArticlesWithMinStock = await prisma.article.findMany({
      where: {
        minStock: { not: null },
      },
      include: {
        batches: {
          where: { quantity: { gt: 0 } },
        },
      },
    });

    // Build a map of minStock values and ensure stock is tracked
    const minStockMap = new Map<string, number>();
    for (const article of allArticlesWithMinStock) {
      if (article.minStock) {
        minStockMap.set(article.id, article.minStock);
        // Also add to stockMap if not already there
        if (!stockMap.has(article.id)) {
          const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);
          stockMap.set(article.id, totalStock);
        }
      }
    }

    // 6. Calculate what needs to be purchased
    // Formula for consumable articles with minStock:
    //   needed = recipeNeed + forecastedConsumption + minStock - currentStock
    // This ensures we have enough for recipes, forecasted consumption, AND maintain minStock buffer
    const itemsToCreate: {
      articleId: string | null;
      customName: string | null;
      neededQuantity: number;
      reason: string;
    }[] = [];

    // Track which articles we've already processed
    const processedArticles = new Set<string>();

    // First, process all required ingredients from recipes
    for (const [, req] of requiredIngredients) {
      const articleId = req.articleId;
      const currentStock = articleId ? (stockMap.get(articleId) || 0) : 0;
      const minStock = articleId ? (minStockMap.get(articleId) || 0) : 0;
      const forecastedNeed = articleId ? (forecastMap.get(articleId) || 0) : 0;

      // Total need = recipe requirement + forecasted consumption + minStock buffer - currentStock
      // We want: currentStock + purchase - recipeNeed - forecastedNeed >= minStock
      // Therefore: purchase >= recipeNeed + forecastedNeed + minStock - currentStock
      const totalNeed = req.totalQuantity + forecastedNeed + minStock - currentStock;

      if (totalNeed > 0) {
        itemsToCreate.push({
          articleId: req.articleId,
          customName: req.articleName || req.categoryMatch,
          neededQuantity: Math.ceil(totalNeed * 100) / 100, // Round to 2 decimals
          reason: req.reason, // Keep RECIPE as reason since that's the primary driver
        });
      }

      if (articleId) {
        processedArticles.add(articleId);
      }
    }

    // Then, add articles that have forecasted consumption but weren't in recipes
    for (const item of forecastedItems) {
      if (processedArticles.has(item.articleId)) continue;

      const currentStock = stockMap.get(item.articleId) || 0;
      const minStock = minStockMap.get(item.articleId) || 0;

      // Need = forecastedConsumption + minStock - currentStock
      const totalNeed = item.quantity + minStock - currentStock;

      if (totalNeed > 0) {
        itemsToCreate.push({
          articleId: item.articleId,
          customName: null,
          neededQuantity: Math.ceil(totalNeed * 100) / 100,
          reason: 'FORECAST',
        });
      }

      processedArticles.add(item.articleId);
    }

    // Finally, add low stock items that weren't covered by recipes or forecast
    for (const article of allArticlesWithMinStock) {
      if (processedArticles.has(article.id)) continue;

      const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);
      if (article.minStock && totalStock < article.minStock) {
        itemsToCreate.push({
          articleId: article.id,
          customName: null,
          neededQuantity: article.minStock - totalStock,
          reason: 'LOW_STOCK',
        });
      }
    }

    // 7. Calculate estimated prices from purchase history
    const articleIdsForPrices = itemsToCreate
      .map((i) => i.articleId)
      .filter((id): id is string => id !== null);

    const articlesWithPrices = await prisma.article.findMany({
      where: { id: { in: articleIdsForPrices } },
      include: {
        batches: {
          where: { purchasePrice: { not: null } },
          orderBy: { purchaseDate: 'desc' },
          take: 10, // Use last 10 purchases for average
        },
      },
    });

    const priceMap = new Map<string, { avgPrice: number; hasPrice: boolean }>();
    for (const article of articlesWithPrices) {
      const batchesWithPrice = article.batches.filter((b: { purchasePrice: number | null }) => b.purchasePrice !== null);
      if (batchesWithPrice.length > 0) {
        // Calculate average price per unit from purchase history
        const totalPrice = batchesWithPrice.reduce((sum: number, b: { purchasePrice: number | null; initialQuantity: number }) =>
          sum + (b.purchasePrice || 0), 0);
        const totalQuantity = batchesWithPrice.reduce((sum: number, b: { initialQuantity: number }) =>
          sum + b.initialQuantity, 0);
        const avgPricePerUnit = totalQuantity > 0 ? totalPrice / totalQuantity : 0;
        priceMap.set(article.id, { avgPrice: avgPricePerUnit, hasPrice: true });
      } else {
        priceMap.set(article.id, { avgPrice: 0, hasPrice: false });
      }
    }

    // 8. Create the shopping list with items including estimated prices
    const list = await prisma.shoppingList.create({
      data: {
        name: name || `Shopping ${shopDateParsed.toLocaleDateString()}`,
        shopDate: shopDateParsed,
        planUntilDate: planUntilParsed,
        items: {
          create: itemsToCreate.map((item) => {
            const priceInfo = item.articleId ? priceMap.get(item.articleId) : null;
            const estimatedPrice = priceInfo?.hasPrice
              ? Math.round(priceInfo.avgPrice * item.neededQuantity * 100) / 100
              : null;
            return {
              articleId: item.articleId,
              customName: item.customName,
              neededQuantity: item.neededQuantity,
              reason: item.reason,
              estimatedPrice,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            article: {
              select: { id: true, name: true, defaultUnit: true, category: true },
            },
          },
        },
      },
    });

    // Map to frontend expected format
    return reply.status(201).send({
      id: list.id,
      name: list.name,
      shopDate: list.shopDate,
      planUntil: list.planUntilDate,
      completedAt: list.completedAt,
      createdAt: list.createdAt,
      items: list.items.map((item) => ({
        id: item.id,
        shoppingListId: item.listId,
        articleId: item.articleId,
        article: item.article,
        customName: item.customName,
        quantity: item.neededQuantity,
        purchasedQuantity: item.purchasedQuantity,
        unit: item.article?.defaultUnit || 'pcs',
        reason: item.reason,
        estimatedPrice: item.estimatedPrice,
        actualPrice: item.actualPrice,
        purchaseDate: item.purchaseDate,
        expiryDate: item.expiryDate,
        purchased: item.isPurchased,
        purchasedAt: null,
        createdAt: list.createdAt,
      })),
      totalItems: list.items.length,
      purchasedItems: 0,
      estimatedTotal: 0,
    });
  });

  // Add item to shopping list
  fastify.post('/shopping-lists/:id/items', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = AddItemSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { articleId, customName, quantity, reason, estimatedPrice } = parseResult.data;

    const item = await prisma.shoppingListItem.create({
      data: {
        listId: id,
        articleId,
        customName,
        neededQuantity: quantity,
        reason,
        estimatedPrice,
      },
      include: {
        article: {
          select: { id: true, name: true, defaultUnit: true, category: true },
        },
      },
    });

    // Map to frontend expected format
    return reply.status(201).send({
      id: item.id,
      shoppingListId: item.listId,
      articleId: item.articleId,
      article: item.article,
      customName: item.customName,
      quantity: item.neededQuantity,
      purchasedQuantity: item.purchasedQuantity,
      unit: item.article?.defaultUnit || 'pcs',
      reason: item.reason,
      estimatedPrice: item.estimatedPrice,
      actualPrice: item.actualPrice,
      purchaseDate: item.purchaseDate,
      expiryDate: item.expiryDate,
      purchased: item.isPurchased,
      purchasedAt: null,
      createdAt: new Date().toISOString(),
    });
  });

  // Update shopping list item (toggle purchased, update quantity)
  fastify.put('/shopping-lists/:listId/items/:itemId', async (request: FastifyRequest<{
    Params: { listId: string; itemId: string };
  }>, reply: FastifyReply) => {
    const { itemId } = request.params;
    const body = request.body as {
      purchased?: boolean;
      quantity?: number;
      neededQuantity?: number;
      purchasedQuantity?: number;
      actualPrice?: number;
      purchaseDate?: string | null;
      expiryDate?: string | null;
    };

    try {
      // If neededQuantity is being updated, recalculate estimatedPrice
      let newEstimatedPrice: number | null | undefined = undefined;
      if (body.neededQuantity !== undefined) {
        // Get the current item to find the articleId
        const currentItem = await prisma.shoppingListItem.findUnique({
          where: { id: itemId },
          select: { articleId: true, estimatedPrice: true, neededQuantity: true },
        });

        if (currentItem?.articleId && currentItem.neededQuantity > 0 && currentItem.estimatedPrice !== null) {
          // Calculate price per unit from current values
          const pricePerUnit = currentItem.estimatedPrice / currentItem.neededQuantity;
          // Calculate new estimated price
          newEstimatedPrice = Math.round(pricePerUnit * body.neededQuantity * 100) / 100;
        }
      }

      const item = await prisma.shoppingListItem.update({
        where: { id: itemId },
        data: {
          ...(body.purchased !== undefined && {
            isPurchased: body.purchased,
          }),
          ...(body.quantity !== undefined && { purchasedQuantity: body.quantity }),
          ...(body.neededQuantity !== undefined && { neededQuantity: body.neededQuantity }),
          ...(body.purchasedQuantity !== undefined && { purchasedQuantity: body.purchasedQuantity }),
          ...(body.actualPrice !== undefined && { actualPrice: body.actualPrice }),
          ...(body.purchaseDate !== undefined && {
            purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
          }),
          ...(body.expiryDate !== undefined && {
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
          }),
          ...(newEstimatedPrice !== undefined && { estimatedPrice: newEstimatedPrice }),
        },
        include: {
          article: {
            select: { id: true, name: true, defaultUnit: true, category: true },
          },
        },
      });

      // Map to frontend expected format
      return {
        id: item.id,
        shoppingListId: item.listId,
        articleId: item.articleId,
        article: item.article,
        customName: item.customName,
        quantity: item.neededQuantity,
        purchasedQuantity: item.purchasedQuantity,
        unit: item.article?.defaultUnit || 'pcs',
        reason: item.reason,
        estimatedPrice: item.estimatedPrice,
        actualPrice: item.actualPrice,
        purchaseDate: item.purchaseDate,
        expiryDate: item.expiryDate,
        purchased: item.isPurchased,
        purchasedAt: null,
        createdAt: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Item not found' });
      }
      throw error;
    }
  });

  // Delete shopping list item
  fastify.delete('/shopping-lists/:listId/items/:itemId', async (request: FastifyRequest<{
    Params: { listId: string; itemId: string };
  }>, reply: FastifyReply) => {
    const { itemId } = request.params;

    try {
      await prisma.shoppingListItem.delete({
        where: { id: itemId },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Item not found' });
      }
      throw error;
    }
  });

  // Complete shopping (creates batches from purchased items)
  fastify.post('/shopping-lists/:id/complete', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const list = await prisma.shoppingList.findUnique({
      where: { id },
      include: {
        items: {
          where: { isPurchased: true, articleId: { not: null } },
        },
      },
    });

    if (!list) {
      return reply.status(404).send({ error: 'Shopping list not found' });
    }

    if (list.completedAt) {
      return reply.status(400).send({ error: 'Shopping list already completed' });
    }

    // Create batches for purchased items with articleId
    const batchPromises = list.items.map((item) => {
      if (!item.articleId) return null;

      return prisma.batch.create({
        data: {
          articleId: item.articleId,
          quantity: item.purchasedQuantity || item.neededQuantity,
          initialQuantity: item.purchasedQuantity || item.neededQuantity,
          purchaseDate: item.purchaseDate || new Date(),
          purchasePrice: item.actualPrice || item.estimatedPrice,
          expiryDate: item.expiryDate,
        },
      });
    });

    await Promise.all(batchPromises.filter(Boolean));

    // Mark list as completed
    const updated = await prisma.shoppingList.update({
      where: { id },
      data: { completedAt: new Date() },
    });

    return updated;
  });

  // Delete shopping list
  fastify.delete('/shopping-lists/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      // Delete items first
      await prisma.shoppingListItem.deleteMany({
        where: { listId: id },
      });

      await prisma.shoppingList.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Shopping list not found' });
      }
      throw error;
    }
  });
}
