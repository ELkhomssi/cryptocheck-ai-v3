/**
 * GramJS MTProto listener — public channels only.
 * Extracted from telegram-listener.ts (Prompt 1); emits RawMessage envelopes to a callback.
 */
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage, type NewMessageEvent } from 'telegram/events/NewMessage.js'
import { EditedMessage, type EditedMessageEvent } from 'telegram/events/EditedMessage.js'
import { DeletedMessage, type DeletedMessageEvent } from 'telegram/events/DeletedMessage.js'
import { FloodWaitError } from 'telegram/errors/index.js'
import { Api } from 'telegram'
import type { Entity } from 'telegram/define.js'
import type { RawMessage, RawMessageEventType } from '@cryptocheck/signal-contracts'
import type { TelegramShardConfig } from './config.js'
import { channelAttribution, serializeEntities } from './serialize.js'
import { markDropped, markFloodWait } from './stats.js'
import { updateHealth } from './health.js'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function messageTimestamp(dateSec: number | undefined): string {
  const sec = typeof dateSec === 'number' && dateSec > 0 ? dateSec : Date.now() / 1000
  return new Date(sec * 1000).toISOString()
}

function buildEnvelope(
  channel: string,
  messageId: string,
  text: string,
  entities: unknown[],
  eventType: RawMessageEventType,
  ts: string,
): RawMessage {
  return {
    channel,
    messageId,
    text,
    entities,
    eventType,
    ts,
    ingestTs: new Date().toISOString(),
  }
}

async function withFloodWait<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof FloodWaitError) {
        markFloodWait()
        const waitMs = (e.seconds + 1) * 1000
        console.warn('[signal-ingestion] FloodWait', { seconds: e.seconds })
        await sleep(waitMs)
        continue
      }
      throw e
    }
  }
}

async function joinPublicChannel(client: TelegramClient, ref: string): Promise<Entity | null> {
  const entity = await withFloodWait(() => client.getEntity(ref))
  if (!entity || typeof entity !== 'object') return null

  const username = 'username' in entity ? (entity as { username?: string }).username : undefined
  if (!username) {
    console.warn('[signal-ingestion] channel is not public (no username) — skipped', { ref })
    markDropped(`non-public channel: ${ref}`)
    return null
  }

  try {
    await withFloodWait(() => client.invoke(new Api.channels.JoinChannel({ channel: entity })))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/already|participant/i.test(msg)) {
      console.warn('[signal-ingestion] join channel warning', { ref, error: msg })
    }
  }

  return entity
}

export type TelegramGramListener = {
  client: TelegramClient
  stop(): Promise<void>
}

export async function startTelegramGramListener(
  config: TelegramShardConfig,
  onEnvelope: (envelope: RawMessage) => void,
): Promise<TelegramGramListener> {
  const session = new StringSession(config.sessionString)
  const client = new TelegramClient(session, config.apiId, config.apiHash, {
    connectionRetries: 8,
    autoReconnect: true,
  })

  await withFloodWait(async () => {
    await client.connect()
  })

  const authorized = await client.checkAuthorization()
  if (!authorized) {
    throw new Error('Telegram session not authorized — generate TELEGRAM_SESSION_STRING via GramJS auth')
  }

  console.info('[signal-ingestion] Connected to Telegram')

  const joined: Entity[] = []
  for (const ref of config.channels) {
    try {
      const entity = await joinPublicChannel(client, ref)
      if (entity) joined.push(entity)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      markDropped(`join failed ${ref}: ${msg}`)
      console.error('[signal-ingestion] failed to join channel', { ref, error: msg })
    }
  }

  if (config.channels.length > 0 && joined.length === 0) {
    console.warn('[signal-ingestion] no channels joined — listener idle until config updated')
  }

  console.info(`[signal-ingestion] Monitoring ${joined.length} channels`)

  updateHealth({
    status: joined.length > 0 ? 'ok' : 'degraded',
    telegram: {
      connected: true,
      authorized: true,
      channelsJoined: joined.length,
      sessionIndex: config.sessionIndex,
      sessionCount: config.sessionCount,
    },
  })

  const allowChannels = new Set<string>()
  const allowChatIds = new Set<string>()
  for (const entity of joined) {
    if (entity && typeof entity === 'object' && 'id' in entity) {
      allowChatIds.add(String((entity as { id: unknown }).id))
    }
    const key = channelAttribution(entity)
    if (key) allowChannels.add(key)
  }

  const isAllowedChat = (chat: unknown): string | null => {
    if (!chat || typeof chat !== 'object') return null
    const id = (chat as Record<string, unknown>).id
    if (id != null && allowChatIds.has(String(id))) return channelAttribution(chat)
    const channel = channelAttribution(chat)
    if (channel && allowChannels.has(channel)) return channel
    return null
  }

  const onNewOrEdit = (eventType: 'new' | 'edit') => async (event: NewMessageEvent | EditedMessageEvent) => {
    try {
      const message = event.message
      const chat = await event.getChat()
      const channel = isAllowedChat(chat)
      if (!channel) return

      const text = message.message ?? ''
      const entities = serializeEntities(message.entities)
      onEnvelope(
        buildEnvelope(
          channel,
          String(message.id),
          text,
          entities,
          eventType,
          messageTimestamp(message.date),
        ),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'handler error'
      markDropped(msg)
      console.error('[signal-ingestion] message handler error', { error: msg })
    }
  }

  const onDelete = async (event: DeletedMessageEvent) => {
    try {
      const chat = await event.getChat()
      const channel = isAllowedChat(chat)
      if (!channel) return

      const ids = event.deletedIds ?? []
      for (const id of ids) {
        onEnvelope(
          buildEnvelope(channel, String(id), '', [], 'delete', new Date().toISOString()),
        )
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'delete handler error'
      markDropped(msg)
      console.error('[signal-ingestion] delete handler error', { error: msg })
    }
  }

  const newHandler = onNewOrEdit('new')
  const editHandler = onNewOrEdit('edit')

  client.addEventHandler(newHandler, new NewMessage({ chats: joined }))
  client.addEventHandler(editHandler, new EditedMessage({ chats: joined }))
  client.addEventHandler(onDelete, new DeletedMessage({ chats: joined }))

  console.info('[TelegramAdapter] gram listener active', {
    channels: joined.length,
    sessionIndex: config.sessionIndex,
    sessionCount: config.sessionCount,
  })

  return {
    client,
    async stop() {
      await client.disconnect()
      updateHealth({
        status: 'down',
        telegram: {
          connected: false,
          authorized: false,
          channelsJoined: 0,
          sessionIndex: config.sessionIndex,
          sessionCount: config.sessionCount,
        },
      })
    },
  }
}
