import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';
import { convertQuantityBetweenUnits } from './units.js';

const IngredientSchema = z.object({
  articleId: z.string().uuid().optional().nullable(),
  categoryMatch: z.string().max(50).optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().max(20),
  isOptional: z.boolean().default(false),
  notes: z.string().max(200).optional().nullable(),
});

const CreateRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  servings: z.number().int().positive().default(2),
  instructions: z.string().max(5000).optional().nullable(),
  prepTime: z.number().int().nonnegative().optional().nullable(),
  cookTime: z.number().int().nonnegative().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  tags: z.string().max(200).optional().nullable(),
  ingredients: z.array(IngredientSchema).optional(),
});

const UpdateRecipeSchema = CreateRecipeSchema.partial();

export async function recipeRoutes(fastify: FastifyInstance) {
  // Get all recipes
  fastify.get('/recipes', async (request: FastifyRequest<{
    Querystring: { search?: string; tags?: string }
  }>, reply: FastifyReply) => {
    const { search, tags } = request.query;

    const recipes = await prisma.recipe.findMany({
      where: {
        ...(search && {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }),
        ...(tags && { tags: { contains: tags } }),
      },
      orderBy: [{ name: 'asc' }],
      include: {
        _count: {
          select: { ingredients: true, mealPlanEntries: true },
        },
      },
    });

    return recipes.map((r: typeof recipes[number]) => ({
      ...r,
      ingredientCount: r._count.ingredients,
      usedInMealPlan: r._count.mealPlanEntries,
      _count: undefined,
    }));
  });

  // Get single recipe with ingredients
  fastify.get('/recipes/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            article: {
              select: {
                id: true,
                name: true,
                defaultUnit: true,
                calories: true,
                protein: true,
                carbs: true,
                fat: true,
                fiber: true,
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    // Calculate total nutrition
    let totalNutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    };

    for (const ing of recipe.ingredients) {
      if (ing.article) {
        // Assuming quantities are in grams/ml for nutrition calculation
        const factor = ing.quantity / 100;
        if (ing.article.calories) totalNutrition.calories += ing.article.calories * factor;
        if (ing.article.protein) totalNutrition.protein += ing.article.protein * factor;
        if (ing.article.carbs) totalNutrition.carbs += ing.article.carbs * factor;
        if (ing.article.fat) totalNutrition.fat += ing.article.fat * factor;
        if (ing.article.fiber) totalNutrition.fiber += ing.article.fiber * factor;
      }
    }

    return {
      ...recipe,
      nutrition: totalNutrition,
      nutritionPerServing: {
        calories: totalNutrition.calories / recipe.servings,
        protein: totalNutrition.protein / recipe.servings,
        carbs: totalNutrition.carbs / recipe.servings,
        fat: totalNutrition.fat / recipe.servings,
        fiber: totalNutrition.fiber / recipe.servings,
      },
    };
  });

  // Create recipe
  fastify.post('/recipes', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateRecipeSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { ingredients, ...recipeData } = parseResult.data;

    const recipe = await prisma.recipe.create({
      data: {
        ...recipeData,
        ingredients: ingredients ? {
          create: ingredients.map((ing) => ({
            articleId: ing.articleId,
            categoryMatch: ing.categoryMatch,
            quantity: ing.quantity,
            unit: ing.unit,
            isOptional: ing.isOptional,
            notes: ing.notes,
          })),
        } : undefined,
      },
      include: {
        ingredients: {
          include: {
            article: {
              select: { id: true, name: true, defaultUnit: true },
            },
          },
        },
      },
    });

    return reply.status(201).send(recipe);
  });

  // Update recipe
  fastify.put('/recipes/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateRecipeSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { ingredients, ...recipeData } = parseResult.data;

    try {
      // Update recipe and replace ingredients if provided
      const recipe = await prisma.$transaction(async (tx) => {
        // Update basic recipe data
        const updated = await tx.recipe.update({
          where: { id },
          data: recipeData,
        });

        // If ingredients provided, delete old and create new
        if (ingredients !== undefined) {
          await tx.recipeIngredient.deleteMany({
            where: { recipeId: id },
          });

          if (ingredients && ingredients.length > 0) {
            await tx.recipeIngredient.createMany({
              data: ingredients.map((ing) => ({
                recipeId: id,
                articleId: ing.articleId,
                categoryMatch: ing.categoryMatch,
                quantity: ing.quantity,
                unit: ing.unit,
                isOptional: ing.isOptional,
                notes: ing.notes,
              })),
            });
          }
        }

        return tx.recipe.findUnique({
          where: { id },
          include: {
            ingredients: {
              include: {
                article: {
                  select: { id: true, name: true, defaultUnit: true },
                },
              },
            },
          },
        });
      });

      return recipe;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Recipe not found' });
      }
      throw error;
    }
  });

  // Delete recipe
  fastify.delete('/recipes/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.recipe.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Recipe not found' });
      }
      throw error;
    }
  });

  // Cook recipe - consume ingredients from inventory
  fastify.post('/recipes/:id/cook', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { servings?: number };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { servings } = (request.body as any) || {};

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          where: { isOptional: false },
          include: {
            article: true,
          },
        },
      },
    });

    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    const portionMultiplier = servings ? servings / recipe.servings : 1;
    const consumptionResults = [];
    const missingIngredients = [];

    for (const ing of recipe.ingredients) {
      const recipeQuantity = ing.quantity * portionMultiplier;

      // Find article (either specific or by category)
      let articleId = ing.articleId;
      let article = ing.article;

      if (!articleId && ing.categoryMatch) {
        // Find first article matching category with stock
        const matchingArticle = await prisma.article.findFirst({
          where: {
            category: ing.categoryMatch,
            batches: {
              some: { quantity: { gt: 0 } },
            },
          },
          include: {
            batches: {
              where: { quantity: { gt: 0 } },
              orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
            },
          },
        });

        if (matchingArticle) {
          articleId = matchingArticle.id;
          article = matchingArticle;
        }
      }

      if (!articleId || !article) {
        missingIngredients.push({
          name: ing.article?.name || ing.categoryMatch || 'Unknown',
          quantity: recipeQuantity,
          unit: ing.unit,
        });
        continue;
      }

      // Convert recipe unit to article's default unit if they differ
      let neededQuantity = recipeQuantity;
      const recipeUnit = ing.unit;
      const articleUnit = article.defaultUnit;

      if (recipeUnit !== articleUnit) {
        const converted = await convertQuantityBetweenUnits(recipeQuantity, recipeUnit, articleUnit);
        if (converted === null) {
          // Units are not convertible - report as missing with unit mismatch
          missingIngredients.push({
            articleId,
            name: article.name,
            needed: recipeQuantity,
            unit: recipeUnit,
            articleUnit: articleUnit,
            error: `Cannot convert ${recipeUnit} to ${articleUnit}`,
          });
          continue;
        }
        neededQuantity = converted;
      }

      // Get batches and consume FIFO
      const batches = await prisma.batch.findMany({
        where: {
          articleId,
          quantity: { gt: 0 },
        },
        orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
      });

      const totalStock = batches.reduce((sum: number, b: { quantity: number }) => sum + b.quantity, 0);

      if (totalStock < neededQuantity) {
        missingIngredients.push({
          articleId,
          name: article.name,
          needed: neededQuantity,
          available: totalStock,
          unit: articleUnit,
          originalQuantity: recipeQuantity,
          originalUnit: recipeUnit,
        });
        continue;
      }

      // Consume from batches
      let remaining = neededQuantity;
      for (const batch of batches) {
        if (remaining <= 0) break;

        const toConsume = Math.min(batch.quantity, remaining);

        await prisma.batch.update({
          where: { id: batch.id },
          data: { quantity: batch.quantity - toConsume },
        });

        await prisma.consumptionLog.create({
          data: {
            articleId,
            batchId: batch.id,
            quantity: toConsume,
            source: 'RECIPE',
            recipeId: id,
            notes: `Cooked: ${recipe.name}`,
          },
        });

        remaining -= toConsume;
      }

      consumptionResults.push({
        articleId,
        name: article.name,
        consumed: neededQuantity,
        unit: articleUnit,
        originalQuantity: recipeQuantity,
        originalUnit: recipeUnit,
      });
    }

    if (missingIngredients.length > 0) {
      return reply.status(400).send({
        error: 'Missing ingredients',
        missing: missingIngredients,
        consumed: consumptionResults,
      });
    }

    return {
      success: true,
      recipe: recipe.name,
      servings: servings || recipe.servings,
      consumed: consumptionResults,
    };
  });

  // Get recipe suggestions based on available inventory
  fastify.get('/recipes/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get all articles with stock
    const articlesWithStock = await prisma.article.findMany({
      where: {
        batches: {
          some: { quantity: { gt: 0 } },
        },
      },
      select: { id: true, category: true },
    });

    const articleIds = articlesWithStock.map((a: { id: string }) => a.id);
    const categories = [...new Set(articlesWithStock.map((a: { category: string | null }) => a.category).filter(Boolean))];

    // Find recipes where all non-optional ingredients are available
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          where: { isOptional: false },
        },
      },
    });

    const suggestions = recipes.filter((recipe: typeof recipes[number]) => {
      return recipe.ingredients.every((ing: { articleId: string | null; categoryMatch: string | null }) => {
        if (ing.articleId && articleIds.includes(ing.articleId)) return true;
        if (ing.categoryMatch && categories.includes(ing.categoryMatch)) return true;
        return false;
      });
    });

    return suggestions.map((r: typeof recipes[number]) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      servings: r.servings,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      tags: r.tags,
    }));
  });
}
