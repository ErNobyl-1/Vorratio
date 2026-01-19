import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';
import { z } from 'zod';

const CreateProductSchema = z.object({
  articleId: z.string().uuid(),
  name: z.string().min(1).max(200),
  barcode: z.string().max(50).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  packageSize: z.number().positive().optional().nullable(),
  packageUnit: z.string().max(20).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const UpdateProductSchema = CreateProductSchema.partial().omit({ articleId: true });

export async function productRoutes(fastify: FastifyInstance) {
  // Get all products for an article
  fastify.get('/articles/:articleId/products', async (request: FastifyRequest<{
    Params: { articleId: string }
  }>, reply: FastifyReply) => {
    const { articleId } = request.params;

    const products = await prisma.product.findMany({
      where: { articleId },
      orderBy: { name: 'asc' },
    });

    return products;
  });

  // Get single product
  fastify.get('/products/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        article: {
          include: { location: true },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    return product;
  });

  // Create product
  fastify.post('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateProductSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { id: data.articleId },
    });

    if (!article) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    // Check for duplicate barcode
    if (data.barcode) {
      const existing = await prisma.product.findUnique({
        where: { barcode: data.barcode },
      });
      if (existing) {
        return reply.status(400).send({ error: 'Barcode already exists' });
      }
    }

    const product = await prisma.product.create({
      data,
      include: { article: true },
    });

    return reply.status(201).send(product);
  });

  // Update product
  fastify.put('/products/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const parseResult = UpdateProductSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;

    // Check for duplicate barcode if changing
    if (data.barcode) {
      const existing = await prisma.product.findFirst({
        where: {
          barcode: data.barcode,
          NOT: { id },
        },
      });
      if (existing) {
        return reply.status(400).send({ error: 'Barcode already exists' });
      }
    }

    try {
      const product = await prisma.product.update({
        where: { id },
        data,
        include: { article: true },
      });

      return product;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Product not found' });
      }
      throw error;
    }
  });

  // Delete product
  fastify.delete('/products/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.product.delete({
        where: { id },
      });

      return reply.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.status(404).send({ error: 'Product not found' });
      }
      throw error;
    }
  });

}
