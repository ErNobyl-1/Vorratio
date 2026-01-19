import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const CreateMealPlanSchema = z.object({
  date: z.string().datetime(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  recipeId: z.string().uuid(),
  servings: z.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
});

const UpdateMealPlanSchema = z.object({
  servings: z.number().int().positive().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function mealPlanRoutes(fastify: FastifyInstance) {
  // Get meal plan entries for date range
  fastify.get('/meal-plan', async (request: FastifyRequest<{
    Querystring: { from: string; to: string }
  }>, reply: FastifyReply) => {
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.status(400).send({ error: 'from and to dates are required' });
    }

    const fromDate = startOfDay(parseISO(from));
    const toDate = endOfDay(parseISO(to));

    const entries = await prisma.mealPlanEntry.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            servings: true,
            prepTime: true,
            cookTime: true,
            imageUrl: true,
          },
        },
      },
    });

    return entries;
  });

  // Get single meal plan entry
  fastify.get('/meal-plan/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const entry = await prisma.mealPlanEntry.findUnique({
      where: { id },
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

    if (!entry) {
      return reply.status(404).send({ error: 'Meal plan entry not found' });
    }

    return entry;
  });

  // Create meal plan entry
  fastify.post('/meal-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateMealPlanSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { date, mealType, recipeId, servings, notes } = parseResult.data;

    // Check recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    // Multiple recipes per date/mealType are now allowed
    const entry = await prisma.mealPlanEntry.create({
      data: {
        date: startOfDay(parseISO(date)),
        mealType,
        recipeId,
        servings,
        notes,
      },
      include: {
        recipe: {
          select: { id: true, name: true, servings: true },
        },
      },
    });

    return reply.status(201).send(entry);
  });

  // Update meal plan entry
  fastify.put('/meal-plan/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateMealPlanSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { servings, notes } = parseResult.data;

    try {
      const entry = await prisma.mealPlanEntry.update({
        where: { id },
        data: {
          ...(servings !== undefined && { servings }),
          ...(notes !== undefined && { notes }),
        },
        include: {
          recipe: {
            select: { id: true, name: true, servings: true },
          },
        },
      });

      return entry;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Meal plan entry not found' });
      }
      throw error;
    }
  });

  // Delete meal plan entry
  fastify.delete('/meal-plan/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.mealPlanEntry.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Meal plan entry not found' });
      }
      throw error;
    }
  });

  // Mark meal as completed (cook the recipe)
  fastify.post('/meal-plan/:id/complete', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const entry = await prisma.mealPlanEntry.findUnique({
      where: { id },
      include: { recipe: true },
    });

    if (!entry) {
      return reply.status(404).send({ error: 'Meal plan entry not found' });
    }

    if (entry.completedAt) {
      return reply.status(400).send({ error: 'Meal already completed' });
    }

    // This will trigger the recipe cook logic
    // For now, just mark as completed - the actual consumption should be triggered separately
    const updated = await prisma.mealPlanEntry.update({
      where: { id },
      data: { completedAt: new Date() },
      include: {
        recipe: {
          select: { id: true, name: true },
        },
      },
    });

    return updated;
  });

  // Mark meal as not completed (undo cook)
  fastify.post('/meal-plan/:id/uncomplete', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const entry = await prisma.mealPlanEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return reply.status(404).send({ error: 'Meal plan entry not found' });
    }

    if (!entry.completedAt) {
      return reply.status(400).send({ error: 'Meal is not completed' });
    }

    const updated = await prisma.mealPlanEntry.update({
      where: { id },
      data: { completedAt: null },
      include: {
        recipe: {
          select: { id: true, name: true },
        },
      },
    });

    return updated;
  });

  // Get ingredients needed for meal plan period
  fastify.get('/meal-plan/ingredients', async (request: FastifyRequest<{
    Querystring: { from: string; to: string }
  }>, reply: FastifyReply) => {
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.status(400).send({ error: 'from and to dates are required' });
    }

    const fromDate = startOfDay(parseISO(from));
    const toDate = endOfDay(parseISO(to));

    // Get all meal plan entries with their recipes and ingredients
    const entries = await prisma.mealPlanEntry.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        completedAt: null, // Only uncompleted meals
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

    // Aggregate ingredients
    const ingredientMap = new Map<string, {
      articleId: string | null;
      articleName: string | null;
      categoryMatch: string | null;
      unit: string;
      totalQuantity: number;
      recipes: string[];
    }>();

    for (const entry of entries) {
      const portionMultiplier = entry.servings / entry.recipe.servings;

      for (const ing of entry.recipe.ingredients) {
        const key = ing.articleId || ing.categoryMatch || `unknown-${ing.id}`;
        const existing = ingredientMap.get(key);
        const neededQuantity = ing.quantity * portionMultiplier;

        if (existing) {
          existing.totalQuantity += neededQuantity;
          if (!existing.recipes.includes(entry.recipe.name)) {
            existing.recipes.push(entry.recipe.name);
          }
        } else {
          ingredientMap.set(key, {
            articleId: ing.articleId,
            articleName: ing.article?.name || null,
            categoryMatch: ing.categoryMatch,
            unit: ing.unit,
            totalQuantity: neededQuantity,
            recipes: [entry.recipe.name],
          });
        }
      }
    }

    return Array.from(ingredientMap.values());
  });
}
