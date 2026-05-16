#!/usr/bin/env node
/* Run all SQL files in a folder against Postgres/Supabase.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/run-all-sql.js ./supabase/migrations
 * Optional env:
 *   SQL_DIR=./supabase/migrations
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function getSqlFiles(folder) {
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
}

async function run() {
  const folder = process.argv[2] || process.env.SQL_DIR || './supabase/migrations'
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL environment variable')
  }
  if (!fs.existsSync(folder)) {
    throw new Error(`SQL folder not found: ${folder}`)
  }

  const files = getSqlFiles(folder)
  if (!files.length) {
    console.log(`No .sql files found in ${folder}`)
    return
  }

  console.log(`Found ${files.length} SQL files in ${folder}`)

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    for (const file of files) {
      const filePath = path.join(folder, file)
      const sql = fs.readFileSync(filePath, 'utf8').trim()

      if (!sql) {
        console.log(`- Skipping empty file: ${file}`)
        continue
      }

      console.log(`\n>> Running ${file}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('COMMIT')
        console.log(`✓ Success ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`✗ Failed ${file}`)
        throw err
      }
    }
  } finally {
    await client.end()
  }

  console.log('\nAll SQL files applied.')
}

run().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
