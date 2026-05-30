/** Little-endian u64 append for Anchor instruction data. */

export function encodeU64(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8)
  let v = typeof value === 'bigint' ? value : BigInt(value)
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}

export function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(4)
  len.writeUInt32LE(bytes.length, 0)
  return Buffer.concat([len, bytes])
}

export function concat(...parts: Buffer[]): Buffer {
  return Buffer.concat(parts)
}
