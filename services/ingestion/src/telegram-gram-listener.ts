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
import { markDropped, markFloodWait, markMessageReceived } from './stats.js'
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

/** Cap join-path FloodWaits so a 700s+ ResolveUsername ban doesn't stall the whole listener. */
const MAX_JOIN_FLOOD_WAIT_SEC = Math.max(
  5,
  Number(process.env.SIGNAL_JOIN_MAX_FLOOD_WAIT_SEC ?? 60) || 60,
)
const JOIN_PACING_MS = Math.max(0, Number(process.env.SIGNAL_JOIN_PACING_MS ?? 750) || 750)

class FloodWaitCapError extends Error {
  constructor(readonly seconds: number) {
    super(`FloodWait capped at ${MAX_JOIN_FLOOD_WAIT_SEC}s (telegram asked ${seconds}s)`)
    this.name = 'FloodWaitCapError'
  }
}

async function withFloodWait<T>(
  fn: () => Promise<T>,
  opts: { maxWaitSec?: number } = {},
): Promise<T> {
  const maxWaitSec = opts.maxWaitSec
  for (;;) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof FloodWaitError) {
        markFloodWait()
        console.warn('[signal-ingestion] FloodWait', { seconds: e.seconds, maxWaitSec })
        if (maxWaitSec != null && e.seconds > maxWaitSec) {
          throw new FloodWaitCapError(e.seconds)
        }
        const waitMs = (e.seconds + 1) * 1000
        await sleep(waitMs)
        continue
      }
      throw e
    }
  }
}

function normalizeChannelRef(ref: string): string {
  const t = ref.trim()
  if (!t) return t
  return t.startsWith('@') ? t.toLowerCase() : `@${t}`.toLowerCase()
}

/** Prefer already-subscribed dialogs — no ResolveUsername / JoinChannel (avoids FloodWait). */
async function collectAllowlistFromDialogs(
  client: TelegramClient,
  allowRefs: Set<string>,
): Promise<Entity[]> {
  const matched: Entity[] = []
  const seen = new Set<string>()
  try {
    const dialogs = await client.getDialogs({ limit: 500 })
    for (const dialog of dialogs) {
      const entity = dialog.entity
      if (!entity || typeof entity !== 'object') continue
      const attr = channelAttribution(entity)
      if (!attr) continue
      const key = normalizeChannelRef(attr)
      if (!allowRefs.has(key) || seen.has(key)) continue
      seen.add(key)
      matched.push(entity as Entity)
    }
    console.info('[signal-ingestion] matched allowlist from existing dialogs', {
      matched: matched.length,
      allowlist: allowRefs.size,
      dialogs: dialogs.length,
    })
  } catch (e) {
    console.warn(
      '[signal-ingestion] getDialogs failed (non-fatal)',
      e instanceof Error ? e.message : e,
    )
  }
  return matched
}

async function joinPublicChannel(client: TelegramClient, ref: string): Promise<Entity | null> {
  const entity = await withFloodWait(() => client.getEntity(ref), {
    maxWaitSec: MAX_JOIN_FLOOD_WAIT_SEC,
  })
  if (!entity || typeof entity !== 'object') return null

  const username = 'username' in entity ? (entity as { username?: string }).username : undefined
  if (!username) {
    console.warn('[signal-ingestion] channel is not public (no username) — skipped', { ref })
    markDropped(`non-public channel: ${ref}`)
    return null
  }

  try {
    await withFloodWait(() => client.invoke(new Api.channels.JoinChannel({ channel: entity })), {
      maxWaitSec: MAX_JOIN_FLOOD_WAIT_SEC,
    })
  } catch (e) {
    if (e instanceof FloodWaitCapError) throw e
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
    await client.start({
      phoneNumber: async () => {
        throw new Error(
          'Telegram session not authorized — generate TELEGRAM_SESSION_STRING via GramJS auth',
        )
      },
      password: async () => '',
      phoneCode: async () => '',
      onError: (err) => console.error('[signal-ingestion] GramJS onError', err),
    })
  })

  console.info('[signal-ingestion] Connected to Telegram')

  const allowRefs = new Set(config.channels.map(normalizeChannelRef).filter(Boolean))
  const joined: Entity[] = []
  const joinedKeys = new Set<string>()
  // Mutable allowlists — handlers + joins share these.
  const allowChannels = new Set<string>()
  const allowChatIds = new Set<string>()

  const publishJoinHealth = (joinedCount: number) => {
    updateHealth({
      status: joinedCount > 0 ? 'ok' : 'degraded',
      telegram: {
        connected: true,
        authorized: true,
        channelsJoined: joinedCount,
        sessionIndex: config.sessionIndex,
        sessionCount: config.sessionCount,
      },
    })
  }

  const trackJoined = (entity: Entity) => {
    const key = channelAttribution(entity)
    const norm = key ? normalizeChannelRef(key) : null
    if (norm && joinedKeys.has(norm)) return
    if (norm) joinedKeys.add(norm)
    joined.push(entity)
    if (entity && typeof entity === 'object' && 'id' in entity) {
      allowChatIds.add(String((entity as { id: unknown }).id))
    }
    if (key) allowChannels.add(key)
    publishJoinHealth(joined.length)
  }

  publishJoinHealth(0)

  // Phase 1: already-subscribed dialogs (no ResolveUsername — avoids FloodWait storms).
  for (const entity of await collectAllowlistFromDialogs(client, allowRefs)) {
    trackJoined(entity)
  }

  const stillMissing = config.channels.filter((ref) => !joinedKeys.has(normalizeChannelRef(ref)))
  console.info('[signal-ingestion] channels still to join/resolve', {
    missing: stillMissing.length,
    already: joined.length,
  })

  // Phase 2: join missing with pacing; abort on capped FloodWait so we can listen ASAP.
  let joinAborted = false
  for (const ref of stillMissing) {
    try {
      if (JOIN_PACING_MS > 0) await sleep(JOIN_PACING_MS)
      const entity = await joinPublicChannel(client, ref)
      if (entity) trackJoined(entity)
    } catch (e) {
      if (e instanceof FloodWaitCapError) {
        joinAborted = true
        console.warn(
          '[signal-ingestion] aborting remaining joins — Telegram FloodWait too long; listening with current set',
          { askedSec: e.seconds, joined: joined.length, remainingApprox: stillMissing.length },
        )
        break
      }
      const msg = e instanceof Error ? e.message : String(e)
      markDropped(`join failed ${ref}: ${msg}`)
      console.error('[signal-ingestion] failed to join channel', { ref, error: msg })
    }
  }

  if (config.channels.length > 0 && joined.length === 0) {
    console.warn('[signal-ingestion] no channels joined — listener idle until config updated')
  }

  console.info(`[signal-ingestion] Monitoring ${joined.length} channels`, {
    joinAborted,
    allowlist: config.channels.length,
  })
  publishJoinHealth(joined.length)

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
      markMessageReceived()
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
      markMessageReceived()
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

  // No chats filter — GramJS string refs in NewMessage({ chats }) miss channel posts.
  // isAllowedChat() below restricts to joined allowlist only.
  client.addEventHandler(newHandler, new NewMessage({}))
  client.addEventHandler(editHandler, new EditedMessage({}))
  client.addEventHandler(onDelete, new DeletedMessage({}))

  console.info('[TelegramAdapter] gram listener active', {
    channels: joined.length,
    sessionIndex: config.sessionIndex,
    sessionCount: config.sessionCount,
  })

  const catchUpRecentMessages = async (): Promise<void> => {
    for (const entity of joined) {
      const channel = channelAttribution(entity)
      if (!channel) continue
      try {
        const messages = await withFloodWait(() => client.getMessages(entity, { limit: 20 }))
        console.info('[signal-ingestion] catch-up', { channel, messages: messages.length })
        for (const message of messages) {
          const text = message.message ?? ''
          if (!text.trim()) continue
          markMessageReceived()
          onEnvelope(
            buildEnvelope(
              channel,
              String(message.id),
              text,
              serializeEntities(message.entities),
              'new',
              messageTimestamp(message.date),
            ),
          )
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'catch-up failed'
        console.warn('[signal-ingestion] catch-up failed', { channel, error: msg })
      }
    }
  }

  void catchUpRecentMessages()

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
