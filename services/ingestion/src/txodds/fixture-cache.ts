import { txOddsJsonHeaders, type TxOddsCredentials } from './auth.js'
import type { TxOddsFixture } from './types.js'

export type FixtureMeta = {
  fixtureId: number
  home: string
  away: string
  competition?: string
}

export class FixtureCache {
  private map = new Map<number, FixtureMeta>()

  size(): number {
    return this.map.size
  }

  get(fixtureId: number): FixtureMeta | undefined {
    return this.map.get(fixtureId)
  }

  label(fixtureId: number): string {
    const meta = this.map.get(fixtureId)
    if (!meta) return `Fixture ${fixtureId}`
    return `${meta.home} vs ${meta.away}`
  }

  teams(fixtureId: number): { home: string; away: string } | undefined {
    const meta = this.map.get(fixtureId)
    if (!meta) return undefined
    return { home: meta.home, away: meta.away }
  }

  upsert(fixture: TxOddsFixture): void {
    const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2
    const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1
    this.map.set(fixture.FixtureId, {
      fixtureId: fixture.FixtureId,
      home,
      away,
      competition: fixture.Competition,
    })
  }

  async refresh(creds: TxOddsCredentials): Promise<void> {
    const res = await fetch(`${creds.apiOrigin}/api/fixtures/snapshot`, {
      headers: txOddsJsonHeaders(creds),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`TxLINE fixtures snapshot failed (${res.status}): ${body || res.statusText}`)
    }
    const fixtures = (await res.json()) as TxOddsFixture[]
    for (const fixture of fixtures) {
      if (typeof fixture.FixtureId === 'number') this.upsert(fixture)
    }
  }
}
