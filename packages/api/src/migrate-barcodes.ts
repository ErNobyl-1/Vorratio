/**
 * Migration script to move barcodes from Article to Product model
 * Run this AFTER prisma db push to migrate existing barcode data
 *
 * Usage: npx tsx src/migrate-barcodes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateBarcodes() {
  console.log('Starting barcode migration...');

  // Check if there are articles that need migration
  // After schema change, articles no longer have barcode field
  // We need to use raw SQL to check the old data if it exists

  try {
    // First, check if the barcode column still exists on Article table
    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM pragma_table_info('Article') WHERE name = 'barcode'
    `;

    if (result.length === 0) {
      console.log('Barcode column already removed from Article. Checking for unmigrated data...');
      return;
    }

    // Get all articles with barcodes using raw SQL since the field may not be in the Prisma model
    const articlesWithBarcodes = await prisma.$queryRaw<{
      id: string;
      name: string;
      barcode: string;
    }[]>`
      SELECT id, name, barcode FROM Article WHERE barcode IS NOT NULL AND barcode != ''
    `;

    if (articlesWithBarcodes.length === 0) {
      console.log('No articles with barcodes found. Migration complete.');
      return;
    }

    console.log(`Found ${articlesWithBarcodes.length} articles with barcodes to migrate.`);

    for (const article of articlesWithBarcodes) {
      // Check if product with this barcode already exists
      const existingProduct = await prisma.product.findUnique({
        where: { barcode: article.barcode }
      });

      if (existingProduct) {
        console.log(`Product with barcode ${article.barcode} already exists, skipping.`);
        continue;
      }

      // Create a Product for this article
      await prisma.product.create({
        data: {
          articleId: article.id,
          name: article.name,
          barcode: article.barcode,
        }
      });

      console.log(`Migrated article "${article.name}" with barcode ${article.barcode}`);
    }

    console.log('Barcode migration completed successfully!');

  } catch (error) {
    // If Product table doesn't exist yet, schema hasn't been updated
    if (error instanceof Error && error.message.includes('Product')) {
      console.log('Product table does not exist yet. Run prisma db push first.');
    } else {
      throw error;
    }
  }
}

migrateBarcodes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
