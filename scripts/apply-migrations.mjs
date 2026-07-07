#!/usr/bin/env node
/**
 * Apply Supabase SQL migrations over a direct Postgres connection.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
 *     npx --yes -p pg node scripts/apply-migrations.mjs [file1.sql file2.sql ...]
 *
 * Get the connection string from Supabase → Project Settings → Database →
 * "Connection string" → URI (use the session pooler, port 5432, and paste your DB password).
 *
 * With no file args, applies the two latest pipeline migrations. Each file is
 * wrapped in a transaction; all migrations here are idempotent (IF NOT EXISTS).
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DEFAULT_MIGRATIONS = [
  'supabase/migrations/20260706_telegram_channels.sql',
  'supabase/migrations/20260707_signal_proof_calls.sql',
]

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim()
  if (!connectionString) {
    console.error('✗ SUPABASE_DB_URL is not set.')
    console.error('  Get it from Supabase → Settings → Database → Connection string (URI).')
    process.exit(1)
  }

  const files = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MIGRATIONS).map((f) =>
    resolve(ROOT, f),
  )

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('✓ Connected to Postgres\n')

  try {
    for (const file of files) {
      const sql = await readFile(file, 'utf8')
      process.stdout.write(`▶ Applying ${file.replace(ROOT + '/', '')} ... `)
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        console.log('OK')
      } catch (err) {
        await client.query('ROLLBACK')
        console.log('FAILED')
        throw err
      }
    }
    console.log('\n✓ All migrations applied.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('\n✗ Migration failed:', err.message)
  process.exit(1)
})
