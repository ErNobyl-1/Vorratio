import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';
import { addDays } from 'date-fns';
import { convertQuantityBetweenUnits } from './units.js';

// Accept both ISO datetime (2024-01-19T00:00:00.000Z) and date-only (2024-01-19) formats
const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format' }
);

const CreateBatchSchema = z.object({
  articleId: z.string().uuid(),
  quantity: z.number().positive(),
  purchaseDate: dateStringSchema.optional(),
  expiryDate: dateStringSchema.optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const UpdateBatchSchema = z.object({
  quantity: z.number().nonnegative().optional(),
  purchaseDate: dateStringSchema.optional(),
  expiryDate: dateStringSchema.optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// Schema for editing purchase data (separate from stock editing)
const UpdatePurchaseSchema = z.object({
  initialQuantity: z.number().positive().optional(),
  purchaseDate: dateStringSchema.optional(),
  expiryDate: dateStringSchema.optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const ConsumeBatchSchema = z.object({
  quantity: z.number().positive(),
  unit: z.string().max(20).optional(), // Optional: if provided, converts from this unit to article's default unit
  source: z.string().max(20).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function batchRoutes(fastify: FastifyInstance) {
  // Get all batches (with optional filters)
  fastify.get('/batches', async (request: FastifyRequest<{
    Querystring: { articleId?: string; hasStock?: string }
  }>, reply: FastifyReply) => {
    const { articleId, hasStock } = request.query;

    const batches = await prisma.batch.findMany({
      where: {
        ...(articleId && { articleId }),
        ...(hasStock === 'true' && { quantity: { gt: 0 } }),
      },
      orderBy: [{ expiryDate: 'asc' }, { purchaseDate: 'asc' }],
      include: {
        article: {
          select: { id: true, name: true, defaultUnit: true },
        },
      },
    });

    return batches;
  });

  // Get single batch
  fastify.get('/batches/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        article: true,
        consumptionLogs: {
          orderBy: { consumedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!batch) {
      return reply.status(404).send({ error: 'Batch not found' });
    }

    return batch;
  });

  // Create batch (add purchase)
  fastify.post('/batches', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateBatchSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { articleId, quantity, purchaseDate, expiryDate, purchasePrice, notes } = parseResult.data;

    // Check article exists and get default expiry days
    const article = await prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    // Calculate expiry date if not provided but article has default
    let finalExpiryDate = expiryDate ? new Date(expiryDate) : null;
    if (!finalExpiryDate && article.defaultExpiryDays) {
      const baseDate = purchaseDate ? new Date(purchaseDate) : new Date();
      finalExpiryDate = addDays(baseDate, article.defaultExpiryDays);
    }

    const batch = await prisma.batch.create({
      data: {
        articleId,
        quantity,
        initialQuantity: quantity,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        expiryDate: finalExpiryDate,
        purchasePrice,
        notes,
      },
      include: {
        article: {
          select: { id: true, name: true, defaultUnit: true },
        },
      },
    });

    return reply.status(201).send(batch);
  });

  // Update batch
  fastify.put('/batches/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateBatchSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { quantity, purchaseDate, expiryDate, purchasePrice, notes } = parseResult.data;

    try {
      // When quantity is updated directly (e.g., editing a purchase),
      // we need to check if this increases initialQuantity or if it's a full correction
      const existingBatch = await prisma.batch.findUnique({ where: { id } });
      if (!existingBatch) {
        return reply.status(404).send({ error: 'Batch not found' });
      }

      // If the new quantity is higher than initialQuantity, update initialQuantity too
      // This handles the case where someone corrects an entry (e.g., 10l -> 1l)
      // Also update initialQuantity if the batch hasn't been consumed yet (quantity == initialQuantity)
      let newInitialQuantity = existingBatch.initialQuantity;
      if (quantity !== undefined) {
        // If quantity equals initialQuantity (no consumption has happened), update both
        // Or if new quantity is greater than initialQuantity
        if (existingBatch.quantity === existingBatch.initialQuantity || quantity > existingBatch.initialQuantity) {
          newInitialQuantity = quantity;
        }
      }

      const batch = await prisma.batch.update({
        where: { id },
        data: {
          ...(quantity !== undefined && { quantity, initialQuantity: newInitialQuantity }),
          ...(purchaseDate !== undefined && { purchaseDate: new Date(purchaseDate) }),
          ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
          ...(purchasePrice !== undefined && { purchasePrice }),
          ...(notes !== undefined && { notes }),
        },
        include: {
          article: {
            select: { id: true, name: true, defaultUnit: true },
          },
        },
      });

      return batch;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Batch not found' });
      }
      throw error;
    }
  });

  // Update purchase data (separate from stock editing)
  // This edits the purchase transaction: initialQuantity, price, dates
  // Stock (quantity) is only adjusted if no consumption has happened yet
  fastify.put('/batches/:id/purchase', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdatePurchaseSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { initialQuantity, purchaseDate, expiryDate, purchasePrice, notes } = parseResult.data;

    try {
      const existingBatch = await prisma.batch.findUnique({ where: { id } });
      if (!existingBatch) {
        return reply.status(404).send({ error: 'Batch not found' });
      }

      // Calculate consumed amount
      const consumed = existingBatch.initialQuantity - existingBatch.quantity;
      const hasBeenConsumed = consumed > 0;

      // Build update data
      const updateData: Record<string, any> = {};

      if (initialQuantity !== undefined) {
        updateData.initialQuantity = initialQuantity;

        // If no consumption has happened, also update current quantity
        // If consumption has happened, keep the consumed amount consistent
        if (!hasBeenConsumed) {
          updateData.quantity = initialQuantity;
        } else {
          // New quantity = new initial - already consumed
          const newQuantity = initialQuantity - consumed;
          if (newQuantity < 0) {
            return reply.status(400).send({
              error: 'Invalid quantity',
              details: `Cannot set initial quantity to ${initialQuantity} because ${consumed} has already been consumed`,
              consumed,
            });
          }
          updateData.quantity = newQuantity;
        }
      }

      if (purchaseDate !== undefined) {
        updateData.purchaseDate = new Date(purchaseDate);
      }
      if (expiryDate !== undefined) {
        updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
      }
      if (purchasePrice !== undefined) {
        updateData.purchasePrice = purchasePrice;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const batch = await prisma.batch.update({
        where: { id },
        data: updateData,
        include: {
          article: {
            select: { id: true, name: true, defaultUnit: true },
          },
        },
      });

      return {
        ...batch,
        consumed,
        hasBeenConsumed,
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Batch not found' });
      }
      throw error;
    }
  });

  // Delete batch
  fastify.delete('/batches/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.batch.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Batch not found' });
      }
      throw error;
    }
  });

  // Consume from specific batch
  fastify.post('/batches/:id/consume', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = ConsumeBatchSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { quantity, unit, source = 'MANUAL', notes } = parseResult.data;

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        article: {
          select: { defaultUnit: true },
        },
      },
    });

    if (!batch) {
      return reply.status(404).send({ error: 'Batch not found' });
    }

    // Convert quantity if a different unit is specified
    let quantityInDefaultUnit = quantity;
    if (unit && unit !== batch.article.defaultUnit) {
      const converted = await convertQuantityBetweenUnits(quantity, unit, batch.article.defaultUnit);
      if (converted === null) {
        return reply.status(400).send({
          error: `Cannot convert ${unit} to ${batch.article.defaultUnit}`,
        });
      }
      quantityInDefaultUnit = converted;
    }

    if (batch.quantity < quantityInDefaultUnit) {
      return reply.status(400).send({
        error: `Insufficient stock. Available: ${batch.quantity} ${batch.article.defaultUnit}`,
        requested: unit ? `${quantity} ${unit} (= ${quantityInDefaultUnit} ${batch.article.defaultUnit})` : `${quantity}`,
      });
    }

    // Update batch and create log in transaction
    const [updatedBatch, log] = await prisma.$transaction([
      prisma.batch.update({
        where: { id },
        data: { quantity: batch.quantity - quantityInDefaultUnit },
      }),
      prisma.consumptionLog.create({
        data: {
          articleId: batch.articleId,
          batchId: id,
          quantity: quantityInDefaultUnit,
          source,
          notes: unit && unit !== batch.article.defaultUnit
            ? `${notes || ''} (${quantity} ${unit})`.trim()
            : notes,
        },
      }),
    ]);

    return {
      batch: updatedBatch,
      log,
      conversion: unit && unit !== batch.article.defaultUnit ? {
        from: { quantity, unit },
        to: { quantity: quantityInDefaultUnit, unit: batch.article.defaultUnit },
      } : undefined,
    };
  });
}
