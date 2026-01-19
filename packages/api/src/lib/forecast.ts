import { prisma } from './db.js';
import { subDays, differenceInDays } from 'date-fns';

/**
 * Consumption Forecasting Library
 *
 * Uses rolling average of consumption history to predict future needs.
 * Only considers articles marked as consumable (isConsumable = true).
 */

export interface ConsumptionForecast {
  articleId: string;
  articleName: string;
  unit: string;
  // Historical data
  totalConsumed: number;
  consumptionDays: number;
  averagePerDay: number;
  averagePerWeek: number;
  // Current state
  currentStock: number;
  // Predictions
  daysUntilEmpty: number | null;
  predictedNeedByDate: Date | null;
  // Recommendation
  recommendedPurchase: number;
}

export interface ForecastOptions {
  lookbackDays?: number;  // How many days of history to analyze (default: 30)
  forecastDays?: number;  // How many days ahead to forecast (default: 7)
}

/**
 * Calculate consumption forecast for all consumable articles
 */
export async function getConsumptionForecasts(
  options: ForecastOptions = {}
): Promise<ConsumptionForecast[]> {
  const { lookbackDays = 30, forecastDays = 7 } = options;
  const lookbackDate = subDays(new Date(), lookbackDays);

  // Get all consumable articles with their consumption logs and current stock
  const articles = await prisma.article.findMany({
    where: { isConsumable: true },
    include: {
      consumptionLogs: {
        where: {
          consumedAt: { gte: lookbackDate },
        },
      },
      batches: {
        where: { quantity: { gt: 0 } },
      },
    },
  });

  const forecasts: ConsumptionForecast[] = [];

  for (const article of articles) {
    // Calculate total consumption in the lookback period
    const totalConsumed = article.consumptionLogs.reduce(
      (sum: number, log: { quantity: number }) => sum + log.quantity,
      0
    );

    // Calculate current stock
    const currentStock = article.batches.reduce(
      (sum: number, batch: { quantity: number }) => sum + batch.quantity,
      0
    );

    // Calculate averages
    const averagePerDay = totalConsumed / lookbackDays;
    const averagePerWeek = averagePerDay * 7;

    // Calculate days until empty
    let daysUntilEmpty: number | null = null;
    let predictedNeedByDate: Date | null = null;

    if (averagePerDay > 0 && currentStock > 0) {
      daysUntilEmpty = Math.floor(currentStock / averagePerDay);
      predictedNeedByDate = new Date();
      predictedNeedByDate.setDate(predictedNeedByDate.getDate() + daysUntilEmpty);
    } else if (currentStock <= 0) {
      daysUntilEmpty = 0;
      predictedNeedByDate = new Date();
    }

    // Calculate recommended purchase (enough for forecast period)
    const neededForPeriod = averagePerDay * forecastDays;
    const recommendedPurchase = Math.max(0, neededForPeriod - currentStock);

    forecasts.push({
      articleId: article.id,
      articleName: article.name,
      unit: article.defaultUnit,
      totalConsumed,
      consumptionDays: lookbackDays,
      averagePerDay,
      averagePerWeek,
      currentStock,
      daysUntilEmpty,
      predictedNeedByDate,
      recommendedPurchase: Math.ceil(recommendedPurchase),
    });
  }

  // Sort by days until empty (most urgent first)
  forecasts.sort((a, b) => {
    if (a.daysUntilEmpty === null && b.daysUntilEmpty === null) return 0;
    if (a.daysUntilEmpty === null) return 1;
    if (b.daysUntilEmpty === null) return -1;
    return a.daysUntilEmpty - b.daysUntilEmpty;
  });

  return forecasts;
}

/**
 * Get forecast for a single article
 */
export async function getArticleForecast(
  articleId: string,
  options: ForecastOptions = {}
): Promise<ConsumptionForecast | null> {
  const { lookbackDays = 30, forecastDays = 7 } = options;
  const lookbackDate = subDays(new Date(), lookbackDays);

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      consumptionLogs: {
        where: {
          consumedAt: { gte: lookbackDate },
        },
      },
      batches: {
        where: { quantity: { gt: 0 } },
      },
    },
  });

  if (!article) return null;

  const totalConsumed = article.consumptionLogs.reduce(
    (sum: number, log: { quantity: number }) => sum + log.quantity,
    0
  );

  const currentStock = article.batches.reduce(
    (sum: number, batch: { quantity: number }) => sum + batch.quantity,
    0
  );

  const averagePerDay = totalConsumed / lookbackDays;
  const averagePerWeek = averagePerDay * 7;

  let daysUntilEmpty: number | null = null;
  let predictedNeedByDate: Date | null = null;

  if (averagePerDay > 0 && currentStock > 0) {
    daysUntilEmpty = Math.floor(currentStock / averagePerDay);
    predictedNeedByDate = new Date();
    predictedNeedByDate.setDate(predictedNeedByDate.getDate() + daysUntilEmpty);
  } else if (currentStock <= 0) {
    daysUntilEmpty = 0;
    predictedNeedByDate = new Date();
  }

  const neededForPeriod = averagePerDay * forecastDays;
  const recommendedPurchase = Math.max(0, neededForPeriod - currentStock);

  return {
    articleId: article.id,
    articleName: article.name,
    unit: article.defaultUnit,
    totalConsumed,
    consumptionDays: lookbackDays,
    averagePerDay,
    averagePerWeek,
    currentStock,
    daysUntilEmpty,
    predictedNeedByDate,
    recommendedPurchase: Math.ceil(recommendedPurchase),
  };
}

/**
 * Get articles that will run out within a given number of days
 */
export async function getArticlesRunningLow(
  days: number = 7
): Promise<ConsumptionForecast[]> {
  const forecasts = await getConsumptionForecasts({ forecastDays: days });

  return forecasts.filter(
    (f) => f.daysUntilEmpty !== null && f.daysUntilEmpty <= days
  );
}

/**
 * Add forecasted items to shopping list generation
 * Returns items that should be added based on consumption patterns
 */
export async function getForecastedShoppingItems(
  shopDate: Date,
  planUntilDate: Date
): Promise<{ articleId: string; quantity: number; unit: string; reason: string }[]> {
  const forecastDays = differenceInDays(planUntilDate, shopDate);
  const forecasts = await getConsumptionForecasts({ forecastDays });

  return forecasts
    .filter((f) => f.recommendedPurchase > 0)
    .map((f) => ({
      articleId: f.articleId,
      quantity: f.recommendedPurchase,
      unit: f.unit,
      reason: 'FORECAST',
    }));
}
