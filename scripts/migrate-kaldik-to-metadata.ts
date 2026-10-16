import 'dotenv/config';
import { createClient } from '@libsql/client';
import { KALDIK_SCHEMA_SQL } from '../server/db/schemas.ts';

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runMigration() {
  const metadataUrl = process.env.TURSO_METADATA_URL?.trim();
  const metadataToken = process.env.TURSO_METADATA_TOKEN?.trim();
  const kaldikUrl = process.env.TURSO_KALDIK_URL?.trim();
  const kaldikToken = process.env.TURSO_KALDIK_TOKEN?.trim();

  if (!metadataUrl || !metadataToken) {
    throw new Error('TURSO_METADATA_URL or TURSO_METADATA_TOKEN is not configured.');
  }
  if (!kaldikUrl || !kaldikToken) {
    throw new Error('TURSO_KALDIK_URL or TURSO_KALDIK_TOKEN is not configured.');
  }

  console.log('Connecting to source (Kaldik) and destination (Metadata/Unified)...');
  const kaldikClient = createClient({ url: kaldikUrl, authToken: kaldikToken });
  const metadataClient = createClient({ url: metadataUrl, authToken: metadataToken });

  // 1. Ensure Kaldik schema tables exist in the metadata database
  console.log('Ensuring kaldik schema tables exist in metadata database...');
  const statements = splitStatements(KALDIK_SCHEMA_SQL);
  await metadataClient.batch(statements, 'write');
  console.log('Schema tables created/verified successfully.');

  // List of tables to migrate from Kaldik to Metadata
  const tablesToMigrate = [
    'periods',
    'kaldik_events',
    'schedule_rules',
    'schedule_rule_periods',
    'schedule_rule_exceptions',
    'materials',
    'syllabus_scopes',
    'syllabus_scope_books',
    'syllabus_scope_items',
  ];

  const migrationSummary: Record<string, { sourceCount: number; migratedCount: number }> = {};

  for (const table of tablesToMigrate) {
    console.log(`\nMigrating table: ${table}...`);
    const sourceRows = await kaldikClient.execute(`SELECT * FROM ${table}`);
    const sourceCount = sourceRows.rows.length;
    console.log(`  Source rows count: ${sourceCount}`);

    if (sourceCount === 0) {
      migrationSummary[table] = { sourceCount: 0, migratedCount: 0 };
      continue;
    }

    // Inspect columns of the table
    const columns = sourceRows.columns;
    const placeholders = columns.map(() => '?').join(', ');
    const columnNames = columns.map((c) => `"${c}"`).join(', ');

    // Clear target table before migration or use INSERT OR REPLACE
    // Using batch inserts in chunks of 50 for safety with Turso limits
    const batchSize = 50;
    const rows = sourceRows.rows;
    let inserted = 0;

    // Delete existing rows in target table to avoid stale duplicates
    await metadataClient.execute(`DELETE FROM ${table}`);

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const batchInserts = chunk.map((row) => ({
        sql: `INSERT OR REPLACE INTO ${table} (${columnNames}) VALUES (${placeholders})`,
        args: columns.map((col) => row[col] ?? null),
      }));
      await metadataClient.batch(batchInserts as any, 'write');
      inserted += chunk.length;
      process.stdout.write(`  Inserted ${inserted}/${sourceCount} rows...\r`);
    }

    console.log(`\n  Successfully migrated ${inserted} rows into ${table}.`);

    // Verify row count in target
    const targetCheck = await metadataClient.execute(`SELECT COUNT(*) as c FROM ${table}`);
    const targetCount = Number(targetCheck.rows[0].c);
    console.log(`  Verified count in unified DB: ${targetCount}`);

    migrationSummary[table] = {
      sourceCount,
      migratedCount: targetCount,
    };
  }

  console.log('\n========================================');
  console.log('MIGRATION SUMMARY');
  console.log('========================================');
  for (const [tbl, stats] of Object.entries(migrationSummary)) {
    const match = stats.sourceCount === stats.migratedCount ? '✅ MATCH' : '❌ MISMATCH';
    console.log(`${tbl.padEnd(26)} Source: ${stats.sourceCount.toString().padStart(4)} | Target: ${stats.migratedCount.toString().padStart(4)} [${match}]`);
  }
  console.log('========================================\n');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
