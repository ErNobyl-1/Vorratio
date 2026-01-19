import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';

// Accept both ISO datetime (2024-01-19T00:00:00.000Z) and date-only (2024-01-19) formats
const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format' }
);

const UpdateConsumptionLogSchema = z.object({
  quantity: z.number().positive().optional(),
  consumedAt: dateStringSchema.optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function consumptionRoutes(fastify: FastifyInstance) {
  // Update consumption log
  fastify.put('/consumption/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateConsumptionLogSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { quantity, consumedAt, notes } = parseResult.data;

    // Get current log to check if it exists
    const currentLog = await prisma.consumptionLog.findUnique({
      where: { id },
    });

    if (!currentLog) {
      return reply.status(404).send({ error: 'Consumption log not found' });
    }

    try {
      const log = await prisma.consumptionLog.update({
        where: { id },
        data: {
          ...(quantity !== undefined && { quantity }),
          ...(consumedAt !== undefined && { consumedAt: new Date(consumedAt) }),
          ...(notes !== undefined && { notes }),
        },
      });

      return log;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Consumption log not found' });
      }
      throw error;
    }
  });

  // Delete consumption log
  fastify.delete('/consumption/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.consumptionLog.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Consumption log not found' });
      }
      throw error;
    }
  });
}
