import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getConsumptionForecasts,
  getArticleForecast,
  getArticlesRunningLow,
} from '../lib/forecast.js';

export async function forecastRoutes(fastify: FastifyInstance) {
  // Get consumption forecasts for all consumable articles
  fastify.get('/forecast', async (request: FastifyRequest<{
    Querystring: { lookbackDays?: string; forecastDays?: string }
  }>, reply: FastifyReply) => {
    const { lookbackDays, forecastDays } = request.query;

    const forecasts = await getConsumptionForecasts({
      lookbackDays: lookbackDays ? parseInt(lookbackDays) : undefined,
      forecastDays: forecastDays ? parseInt(forecastDays) : undefined,
    });

    return forecasts;
  });

  // Get forecast for a single article
  fastify.get('/forecast/article/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Querystring: { lookbackDays?: string; forecastDays?: string }
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { lookbackDays, forecastDays } = request.query;

    const forecast = await getArticleForecast(id, {
      lookbackDays: lookbackDays ? parseInt(lookbackDays) : undefined,
      forecastDays: forecastDays ? parseInt(forecastDays) : undefined,
    });

    if (!forecast) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    return forecast;
  });

  // Get articles running low (will run out within X days)
  fastify.get('/forecast/running-low', async (request: FastifyRequest<{
    Querystring: { days?: string }
  }>, reply: FastifyReply) => {
    const { days } = request.query;

    const articles = await getArticlesRunningLow(
      days ? parseInt(days) : undefined
    );

    return articles;
  });
}
