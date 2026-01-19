import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';

const CreateUnitSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  conversionGroup: z.string().max(20).optional().nullable(),
  conversionFactor: z.number().positive().optional().default(1),
  convertsToUnitId: z.string().uuid().optional().nullable(),
  convertsToAmount: z.number().positive().optional().nullable(),
});

const UpdateUnitSchema = z.object({
  symbol: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(50).optional(),
  conversionGroup: z.string().max(20).optional().nullable(),
  conversionFactor: z.number().positive().optional(),
  convertsToUnitId: z.string().uuid().optional().nullable(),
  convertsToAmount: z.number().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

// Default units to seed if none exist
const DEFAULT_UNITS = [
  { symbol: 'pcs', name: 'Stück', conversionGroup: null, conversionFactor: 1, sortOrder: 0 },
  { symbol: 'g', name: 'Gramm', conversionGroup: 'mass', conversionFactor: 1, sortOrder: 1 },
  { symbol: 'kg', name: 'Kilogramm', conversionGroup: 'mass', conversionFactor: 1000, sortOrder: 2 },
  { symbol: 'ml', name: 'Milliliter', conversionGroup: 'volume', conversionFactor: 1, sortOrder: 3 },
  { symbol: 'l', name: 'Liter', conversionGroup: 'volume', conversionFactor: 1000, sortOrder: 4 },
];

export async function unitsRoutes(fastify: FastifyInstance) {
  // Initialize default units if none exist
  const existingUnits = await prisma.unit.count();
  if (existingUnits === 0) {
    await prisma.unit.createMany({
      data: DEFAULT_UNITS.map(u => ({ ...u, isDefault: true })),
    });
  }

  // Get all units
  fastify.get('/units', async (request: FastifyRequest, reply: FastifyReply) => {
    const units = await prisma.unit.findMany({
      orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
      include: {
        convertsToUnit: {
          select: { id: true, symbol: true, name: true },
        },
      },
    });

    return units;
  });

  // Get a single unit by ID
  fastify.get('/units/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        convertsToUnit: {
          select: { id: true, symbol: true, name: true },
        },
      },
    });

    if (!unit) {
      return reply.status(404).send({ error: 'Unit not found' });
    }

    return unit;
  });

  // Create a new unit
  fastify.post('/units', async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticated = (request.session as any).authenticated === true;
    if (!authenticated) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const parseResult = CreateUnitSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { symbol, name, conversionGroup, conversionFactor, convertsToUnitId, convertsToAmount } = parseResult.data;

    // Check if symbol already exists
    const existing = await prisma.unit.findUnique({ where: { symbol } });
    if (existing) {
      return reply.status(409).send({ error: 'Unit with this symbol already exists' });
    }

    // If custom conversion, validate the target unit exists
    if (convertsToUnitId) {
      const targetUnit = await prisma.unit.findUnique({ where: { id: convertsToUnitId } });
      if (!targetUnit) {
        return reply.status(400).send({ error: 'Target conversion unit not found' });
      }
    }

    // Get max sortOrder
    const maxSort = await prisma.unit.aggregate({ _max: { sortOrder: true } });
    const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const unit = await prisma.unit.create({
      data: {
        symbol,
        name,
        conversionGroup: conversionGroup || null,
        conversionFactor: conversionFactor || 1,
        convertsToUnitId: convertsToUnitId || null,
        convertsToAmount: convertsToAmount || null,
        isDefault: false,
        sortOrder: nextSortOrder,
      },
      include: {
        convertsToUnit: {
          select: { id: true, symbol: true, name: true },
        },
      },
    });

    return reply.status(201).send(unit);
  });

  // Update a unit
  fastify.put('/units/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const authenticated = (request.session as any).authenticated === true;
    if (!authenticated) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { id } = request.params;
    const parseResult = UpdateUnitSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const existing = await prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Unit not found' });
    }

    const { symbol, name, conversionGroup, conversionFactor, convertsToUnitId, convertsToAmount, sortOrder } = parseResult.data;

    // If changing symbol, check for uniqueness
    if (symbol && symbol !== existing.symbol) {
      const duplicate = await prisma.unit.findUnique({ where: { symbol } });
      if (duplicate) {
        return reply.status(409).send({ error: 'Unit with this symbol already exists' });
      }
    }

    // If custom conversion, validate the target unit exists
    if (convertsToUnitId) {
      const targetUnit = await prisma.unit.findUnique({ where: { id: convertsToUnitId } });
      if (!targetUnit) {
        return reply.status(400).send({ error: 'Target conversion unit not found' });
      }
      // Prevent self-reference
      if (convertsToUnitId === id) {
        return reply.status(400).send({ error: 'Unit cannot convert to itself' });
      }
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: {
        ...(symbol !== undefined && { symbol }),
        ...(name !== undefined && { name }),
        ...(conversionGroup !== undefined && { conversionGroup: conversionGroup || null }),
        ...(conversionFactor !== undefined && { conversionFactor }),
        ...(convertsToUnitId !== undefined && { convertsToUnitId: convertsToUnitId || null }),
        ...(convertsToAmount !== undefined && { convertsToAmount: convertsToAmount || null }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: {
        convertsToUnit: {
          select: { id: true, symbol: true, name: true },
        },
      },
    });

    return updated;
  });

  // Delete a unit
  fastify.delete('/units/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const authenticated = (request.session as any).authenticated === true;
    if (!authenticated) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { id } = request.params;

    const existing = await prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Unit not found' });
    }

    // Check if unit is used in articles
    const articlesUsingUnit = await prisma.article.count({
      where: {
        OR: [
          { defaultUnit: existing.symbol },
          { packageUnit: existing.symbol },
        ],
      },
    });

    if (articlesUsingUnit > 0) {
      return reply.status(400).send({
        error: 'Unit is in use',
        details: `This unit is used by ${articlesUsingUnit} article(s). Please change the unit on those articles first.`,
      });
    }

    // Check if unit is used in recipe ingredients
    const recipesUsingUnit = await prisma.recipeIngredient.count({
      where: { unit: existing.symbol },
    });

    if (recipesUsingUnit > 0) {
      return reply.status(400).send({
        error: 'Unit is in use',
        details: `This unit is used in ${recipesUsingUnit} recipe ingredient(s). Please change the unit on those ingredients first.`,
      });
    }

    // Check if other units convert to this one
    const dependentUnits = await prisma.unit.count({
      where: { convertsToUnitId: id },
    });

    if (dependentUnits > 0) {
      return reply.status(400).send({
        error: 'Unit has dependencies',
        details: `${dependentUnits} unit(s) are configured to convert to this unit. Please remove those conversions first.`,
      });
    }

    await prisma.unit.delete({ where: { id } });

    return reply.status(204).send();
  });

  // Utility endpoint: Convert quantity between units
  fastify.get('/units/convert', async (request: FastifyRequest<{
    Querystring: { from: string; to: string; quantity: string }
  }>, reply: FastifyReply) => {
    const { from, to, quantity: quantityStr } = request.query;
    const quantity = parseFloat(quantityStr);

    if (isNaN(quantity)) {
      return reply.status(400).send({ error: 'Invalid quantity' });
    }

    const fromUnit = await prisma.unit.findUnique({ where: { symbol: from } });
    const toUnit = await prisma.unit.findUnique({ where: { symbol: to } });

    if (!fromUnit) {
      return reply.status(404).send({ error: `Unit '${from}' not found` });
    }
    if (!toUnit) {
      return reply.status(404).send({ error: `Unit '${to}' not found` });
    }

    const result = convertUnits(quantity, fromUnit, toUnit);

    if (result === null) {
      return reply.status(400).send({
        error: 'Units are not convertible',
        details: `Cannot convert between '${from}' and '${to}'`,
      });
    }

    return {
      from: { symbol: from, quantity },
      to: { symbol: to, quantity: result },
    };
  });
}

// Unit conversion helper function
export interface UnitData {
  id?: string;
  symbol: string;
  conversionGroup: string | null;
  conversionFactor: number;
  convertsToUnitId: string | null;
  convertsToAmount: number | null;
  convertsToUnit?: { id: string; symbol: string } | null;
}

export function convertUnits(
  quantity: number,
  fromUnit: UnitData,
  toUnit: UnitData
): number | null {
  // Same unit - no conversion needed
  if (fromUnit.symbol === toUnit.symbol) {
    return quantity;
  }

  // Check if units are in the same conversion group (e.g., both mass or both volume)
  if (fromUnit.conversionGroup && fromUnit.conversionGroup === toUnit.conversionGroup) {
    // Convert: from -> base unit -> to
    // Example: 2 kg -> g -> ml would fail because different groups
    // Example: 2 kg -> 2000 g (kg factor=1000, g factor=1)
    const baseQuantity = quantity * fromUnit.conversionFactor;
    const result = baseQuantity / toUnit.conversionFactor;
    return result;
  }

  // Check for custom conversion (e.g., Rolle -> Blatt)
  // fromUnit converts to another unit
  if (fromUnit.convertsToUnitId && fromUnit.convertsToAmount) {
    // Direct conversion: fromUnit -> toUnit
    if (fromUnit.convertsToUnit?.symbol === toUnit.symbol || fromUnit.convertsToUnitId === toUnit.id) {
      // 1 fromUnit = convertsToAmount toUnit
      return quantity * fromUnit.convertsToAmount;
    }
  }

  // Reverse custom conversion: toUnit converts to fromUnit
  if (toUnit.convertsToUnitId && toUnit.convertsToAmount) {
    if (toUnit.convertsToUnit?.symbol === fromUnit.symbol || toUnit.convertsToUnitId === fromUnit.id) {
      // 1 toUnit = convertsToAmount fromUnit
      // So 1 fromUnit = 1/convertsToAmount toUnit
      return quantity / toUnit.convertsToAmount;
    }
  }

  // Units are not convertible
  return null;
}

// Helper to convert quantity with unit lookup from database
export async function convertQuantityBetweenUnits(
  quantity: number,
  fromSymbol: string,
  toSymbol: string
): Promise<number | null> {
  if (fromSymbol === toSymbol) {
    return quantity;
  }

  const fromUnit = await prisma.unit.findUnique({
    where: { symbol: fromSymbol },
    include: {
      convertsToUnit: {
        select: { id: true, symbol: true },
      },
    },
  });

  const toUnit = await prisma.unit.findUnique({
    where: { symbol: toSymbol },
    include: {
      convertsToUnit: {
        select: { id: true, symbol: true },
      },
    },
  });

  if (!fromUnit || !toUnit) {
    return null;
  }

  return convertUnits(quantity, fromUnit, toUnit);
}
