import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';

const UpdateSettingsSchema = z.object({
  locale: z.enum(['en', 'de']).optional(),
  defaultShopDay: z.number().min(0).max(6).optional(),
  currency: z.string().min(1).max(3).optional(),
});

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get app settings (public - needed before login for locale)
  fastify.get('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'app' },
      select: { locale: true, defaultShopDay: true, currency: true },
    });

    return {
      locale: settings?.locale || 'en',
      defaultShopDay: settings?.defaultShopDay ?? 6,
      currency: settings?.currency || 'EUR',
    };
  });

  // Update app settings (requires authentication)
  fastify.put('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticated = (request.session as any).authenticated === true;
    if (!authenticated) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const parseResult = UpdateSettingsSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { locale, defaultShopDay, currency } = parseResult.data;

    const updated = await prisma.appSettings.update({
      where: { id: 'app' },
      data: {
        ...(locale && { locale }),
        ...(defaultShopDay !== undefined && { defaultShopDay }),
        ...(currency && { currency }),
      },
      select: { locale: true, defaultShopDay: true, currency: true },
    });

    return {
      locale: updated.locale,
      defaultShopDay: updated.defaultShopDay,
      currency: updated.currency,
    };
  });
}
