import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkPassword, changePassword } from '../lib/auth.js';
import { z } from 'zod';

const LoginSchema = z.object({
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = LoginSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Password is required' });
    }

    const { password } = parseResult.data;
    const isValid = await checkPassword(password);

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }

    // Set session
    (request.session as any).authenticated = true;

    return { success: true };
  });

  // Logout
  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    request.session.destroy();
    return { success: true };
  });

  // Check auth status
  fastify.get('/auth/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticated = (request.session as any).authenticated === true;
    return { authenticated };
  });

  // Change password
  fastify.post('/auth/change-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticated = (request.session as any).authenticated === true;
    if (!authenticated) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const parseResult = ChangePasswordSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { currentPassword, newPassword } = parseResult.data;

    const isValid = await checkPassword(currentPassword);
    if (!isValid) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    await changePassword(newPassword);

    return { success: true };
  });
}
