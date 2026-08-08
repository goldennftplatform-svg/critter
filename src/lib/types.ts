export type CachedRound = {
  id: number
  /** API square 0–24 (site displays as 1–25) */
  square: number
  ts: string
  deployed: number
  winnings: number
  minted: number
  buyback: number
  outcome: string
  motherlodeTier: string
  motherlodeSol: number
  motherlodeOre: number
  winners: number
  miners: number
  topMiner: string | null
  roundWinner: string | null
}

export type CacheStatus = {
  updatedAt: string | null
  syncing: boolean
  lastSyncError: string | null
  count: number
  newestId: number | null
  oldestId: number | null
  newestTs: string | null
  source: string
  localOnly: boolean
}

export type SquareStat = {
  /** Display square 1–25 */
  square: number
  apiSquare: number
  hits: number
  frequency: number
  expected: number
  delta: number
  gap: number
  dueScore: number
  lastRoundId: number | null
  lastTs: string | null
}

export type PatternBucket = {
  key: string
  label: string
  hits: number
  share: number
  expected: number
  delta: number
  streak: number
  squares: number[]
}

export type PickGuidance = {
  rank: number
  square: number
  reason: string
  gap: number
  hits: number
  score: number
}

export type Analysis = {
  window: number
  total: number
  squares: SquareStat[]
  hot: SquareStat[]
  due: SquareStat[]
  cold: SquareStat[]
  picks: PickGuidance[]
  patterns: {
    parity: PatternBucket[]
    thirds: PatternBucket[]
    highLow: PatternBucket[]
    rows: PatternBucket[]
    cols: PatternBucket[]
  }
  recent: CachedRound[]
  lastSquare: number | null
}
