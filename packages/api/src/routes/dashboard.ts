import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { startOfDay, endOfDay, addDays, subDays } from 'date-fns';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard data
  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const in7Days = endOfDay(addDays(today, 7));

    // Get expiring batches (within 7 days)
    const expiringBatches = await prisma.batch.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: {
          lte: in7Days,
        },
      },
      orderBy: { expiryDate: 'asc' },
      include: {
        article: {
          include: { location: true },
        },
      },
    });

    // Separate expired and expiring soon
    const expired = expiringBatches.filter(
      (b: { expiryDate: Date | null }) => b.expiryDate && b.expiryDate < todayStart
    );
    const expiringSoon = expiringBatches.filter(
      (b: { expiryDate: Date | null }) => b.expiryDate && b.expiryDate >= todayStart
    );

    // Get low stock articles
    const allArticles = await prisma.article.findMany({
      where: {
        minStock: { not: null },
      },
      include: {
        location: true,
        batches: {
          where: { quantity: { gt: 0 } },
        },
      },
    });

    const lowStockArticles = allArticles
      .map((article: typeof allArticles[number]) => {
        const totalStock = article.batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);
        return {
          ...article,
          totalStock,
          shortfall: (article.minStock || 0) - totalStock,
        };
      })
      .filter((a: { totalStock: number; minStock: number | null }) => a.totalStock < (a.minStock || 0))
      .sort((a: { shortfall: number }, b: { shortfall: number }) => b.shortfall - a.shortfall);

    // Get today's meal plan
    const todaysMeals = await prisma.mealPlanEntry.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: endOfDay(today),
        },
      },
      orderBy: { mealType: 'asc' },
      include: {
        recipe: {
          select: { id: true, name: true, servings: true },
        },
      },
    });

    // Get active shopping list summary
    const activeShoppingList = await prisma.shoppingList.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
        items: {
          select: { estimatedPrice: true, isPurchased: true },
        },
      },
    });

    let shoppingListSummary = null;
    if (activeShoppingList) {
      const totalItems = activeShoppingList._count.items;
      const purchasedItems = activeShoppingList.items.filter((i: { isPurchased: boolean }) => i.isPurchased).length;
      const estimatedTotal = activeShoppingList.items.reduce(
        (sum: number, i: { estimatedPrice: number | null }) => sum + (i.estimatedPrice || 0),
        0
      );

      shoppingListSummary = {
        id: activeShoppingList.id,
        name: activeShoppingList.name,
        shopDate: activeShoppingList.shopDate,
        totalItems,
        purchasedItems,
        estimatedTotal,
      };
    }

    // Get inventory stats
    const stats = await prisma.$transaction([
      prisma.article.count(),
      prisma.batch.count({ where: { quantity: { gt: 0 } } }),
      prisma.storageLocation.count(),
      prisma.recipe.count(),
    ]);

    return {
      expiring: {
        expired,
        expiringSoon,
      },
      lowStock: lowStockArticles,
      todaysMeals,
      shoppingList: shoppingListSummary,
      stats: {
        totalArticles: stats[0],
        activeBatches: stats[1],
        locations: stats[2],
        recipes: stats[3],
      },
    };
  });
}
