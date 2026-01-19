import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';

const CreateLocationSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(10).optional(),
  sortOrder: z.number().optional(),
});

const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(10).nullable().optional(),
  sortOrder: z.number().optional(),
});

export async function locationRoutes(fastify: FastifyInstance) {
  // Get all locations
  fastify.get('/locations', async (request: FastifyRequest, reply: FastifyReply) => {
    const locations = await prisma.storageLocation.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    return locations.map((loc: typeof locations[number]) => ({
      ...loc,
      articleCount: loc._count.articles,
      _count: undefined,
    }));
  });

  // Get single location
  fastify.get('/locations/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const location = await prisma.storageLocation.findUnique({
      where: { id },
      include: {
        articles: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            batches: {
              where: { quantity: { gt: 0 } },
              orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
            },
          },
        },
      },
    });

    if (!location) {
      return reply.status(404).send({ error: 'Location not found' });
    }

    return location;
  });

  // Create location
  fastify.post('/locations', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateLocationSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { name, icon, sortOrder } = parseResult.data;

    // Get max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.storageLocation.aggregate({
        _max: { sortOrder: true },
      });
      order = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    const location = await prisma.storageLocation.create({
      data: {
        name,
        icon,
        sortOrder: order,
      },
    });

    return reply.status(201).send(location);
  });

  // Update location
  fastify.put('/locations/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateLocationSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { name, icon, sortOrder } = parseResult.data;

    try {
      const location = await prisma.storageLocation.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(icon !== undefined && { icon }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
      });

      return location;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Location not found' });
      }
      throw error;
    }
  });

  // Delete location
  fastify.delete('/locations/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Check if location has articles
    const articleCount = await prisma.article.count({
      where: { locationId: id },
    });

    if (articleCount > 0) {
      return reply.status(400).send({
        error: 'Cannot delete location with articles. Move or delete articles first.',
      });
    }

    try {
      await prisma.storageLocation.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Location not found' });
      }
      throw error;
    }
  });
}
