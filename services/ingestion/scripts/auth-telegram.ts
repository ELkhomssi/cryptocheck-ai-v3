/**
 * One-time GramJS session bootstrap.
 * Run: TELEGRAM_API_ID=… TELEGRAM_API_HASH=… npm run auth --prefix services/ingestion
 */
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

async function main(): Promise<void> {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH?.trim() ?? ''
  if (!Number.isFinite(apiId) || !apiHash) {
    throw new Error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH')
  }

  const rl = createInterface({ input, output })
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 })
  await client.start({
    phoneNumber: async () => rl.question('Phone (+countrycode): '),
    password: async () => rl.question('2FA password (if any): '),
    phoneCode: async () => rl.question('Code from Telegram: '),
    onError: (err) => console.error(err),
  })

  const session = client.session.save() as unknown as string
  console.log('\nTELEGRAM_SESSION_STRING=\n' + session + '\n')
  await client.disconnect()
  rl.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
