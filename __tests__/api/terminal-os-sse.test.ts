import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSseStream, SSE_SOFT_CLOSE_MS } from '../../lib/terminal-os/sse'

async function readUntilClose(
  stream: ReadableStream<Uint8Array>,
  timeoutMs: number,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ''
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now())
    const result = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      ),
    ])
    if (result.done) break
    if (result.value) out += decoder.decode(result.value, { stream: true })
  }
  try {
    await reader.cancel()
  } catch {
    /* ignore */
  }
  return out
}

describe('Terminal OS SSE soft-close', () => {
  it('exports soft-close under the Vercel 300s hard kill', () => {
    assert.ok(SSE_SOFT_CLOSE_MS < 300_000)
    assert.ok(SSE_SOFT_CLOSE_MS >= 60_000)
  })

  it('emits reconnect then closes before a hard timeout', async () => {
    let ticks = 0
    const stream = createSseStream({
      intervalMs: 50,
      softCloseMs: 180,
      onTick: (send) => {
        ticks += 1
        send('heartbeat', { n: ticks })
      },
    })

    const body = await readUntilClose(stream, 2_000)
    assert.match(body, /event: ready/)
    assert.match(body, /event: heartbeat/)
    assert.match(body, /event: reconnect/)
    assert.match(body, /soft_close/)
  })
})
