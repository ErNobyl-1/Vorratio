import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from './db.js';

const SALT_LENGTH = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;

  const hash = createHash('sha256').update(salt + password).digest('hex');

  // Use timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export async function initializeAuth(): Promise<void> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'app' },
  });

  if (!settings) {
    // Create default settings with password and locale from env
    const defaultPassword = process.env.AUTH_PASSWORD || 'admin';
    const defaultLocale = process.env.DEFAULT_LOCALE || 'en';
    await prisma.appSettings.create({
      data: {
        id: 'app',
        password: hashPassword(defaultPassword),
        locale: defaultLocale,
      },
    });
    console.log(`Auth initialized with password from AUTH_PASSWORD env var (or default "admin"), locale: ${defaultLocale}`);
  } else {
    console.log('Auth already configured. To reset password, delete AppSettings from database or use the web UI.');
  }
}

export async function checkPassword(password: string): Promise<boolean> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'app' },
  });

  if (!settings) {
    return false;
  }

  return verifyPassword(password, settings.password);
}

export async function changePassword(newPassword: string): Promise<void> {
  await prisma.appSettings.update({
    where: { id: 'app' },
    data: {
      password: hashPassword(newPassword),
    },
  });
}
