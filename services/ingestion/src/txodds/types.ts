/** Minimal TxLINE payload shapes for normalize (Prompt 2). */

export type TxOddsStreamKind = 'scores' | 'odds'

export type TxOddsScoresPayload = {
  fixtureId: number
  seq: number
  ts: number
  action: string
  gameState: string
  participant1Id?: number
  participant2Id?: number
  scoreSoccer?: {
    Participant1?: { HT?: { Goals?: number }; H1?: { Goals?: number }; H2?: { Goals?: number } }
    Participant2?: { HT?: { Goals?: number }; H1?: { Goals?: number }; H2?: { Goals?: number } }
  }
  dataSoccer?: {
    Goal?: boolean
    RedCard?: boolean
    YellowCard?: boolean
    Action?: string
    Type?: string
  }
  [key: string]: unknown
}

export type TxOddsOddsPayload = {
  FixtureId: number
  MessageId: string
  Ts: number
  SuperOddsType: string
  GameState?: string
  MarketParameters?: string
  MarketPeriod?: string
  PriceNames?: string[]
  Prices?: number[]
  Pct?: string[]
  Bookmaker?: string
  InRunning?: boolean
  [key: string]: unknown
}

export type TxOddsFixture = {
  FixtureId: number
  Participant1: string
  Participant2: string
  Participant1IsHome: boolean
  Competition?: string
  StartTime?: number
}

export type TxOddsRawPacket =
  | { kind: 'scores'; payload: TxOddsScoresPayload }
  | { kind: 'odds'; payload: TxOddsOddsPayload }
