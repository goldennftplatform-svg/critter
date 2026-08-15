import { ROUNDS_PER_DAY } from './bps'
import { toDisplay } from './format'
import type { CachedRound } from './types'

export type TroveHit = {
  id: number
  square: number
  ts: string
  tier: string
  sol: number
  ore: number
}

export type TroveSquare = {
  square: number
  n: number
}

export type TroveDesk = {
  hits: TroveHit[]
  last: TroveHit | null
  since: number
  avgGap: number
  medianGap: number
  minGap: number
  maxGap: number
  dueMult: number
  estRounds: number
  rate: number
  minor: number
  major: number
  sample: number
  pool: number
  bySquare: TroveSquare[]
}

const MS_PER_ROUND = (24 * 60 * 60 * 1000) / ROUNDS_PER_DAY

export function isTrove(r: CachedRound) {
  const t = String(r.motherlodeTier || '')
  return Boolean(t) && !/^none$/i.test(t)
}

export function fmtJackpot(lamports: number) {
  const n = Number(lamports || 0) / 1e9
  if (n >= 10) return n.toFixed(1)
  if (n >= 1) return n.toFixed(2)
  if (n <= 0) return '0'
  return n.toFixed(3)
}

export function fmtRoundsClock(rounds: number) {
  const mins = Math.max(0, Math.round(rounds * (MS_PER_ROUND / 60_000)))
  if (mins < 60) return `${mins}m`
  const hrs = mins / 60
  if (hrs < 24) return `${hrs.toFixed(hrs >= 10 ? 0 : 1)}h`
  return `${(hrs / 24).toFixed(1)}d`
}

function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function analyzeTrove(roundsNewestFirst: CachedRound[]): TroveDesk {
  const hits: TroveHit[] = []
  const idxs: number[] = []
  roundsNewestFirst.forEach((r, i) => {
    if (!isTrove(r)) return
    hits.push({
      id: r.id,
      square: toDisplay(r.square),
      ts: r.ts,
      tier: String(r.motherlodeTier),
      sol: r.motherlodeSol || 0,
      ore: r.motherlodeOre || 0,
    })
    idxs.push(i)
  })

  const gaps: number[] = []
  for (let i = 0; i < idxs.length - 1; i++) gaps.push(idxs[i + 1] - idxs[i])

  const since = idxs[0] ?? roundsNewestFirst.length
  const avgGap = gaps.length ? gaps.reduce((s, n) => s + n, 0) / gaps.length : 0
  const dueMult = avgGap > 0 ? since / avgGap : 0

  const counts = new Map<number, number>()
  for (const h of hits) counts.set(h.square, (counts.get(h.square) || 0) + 1)
  const bySquare = [...counts.entries()]
    .map(([square, n]) => ({ square, n }))
    .sort((a, b) => b.n - a.n || a.square - b.square)

  return {
    hits,
    last: hits[0] ?? null,
    since,
    avgGap,
    medianGap: median(gaps),
    minGap: gaps.length ? Math.min(...gaps) : 0,
    maxGap: gaps.length ? Math.max(...gaps) : 0,
    dueMult,
    estRounds: avgGap > 0 ? Math.max(0, Math.round(avgGap - since)) : 0,
    rate: roundsNewestFirst.length ? hits.length / roundsNewestFirst.length : 0,
    minor: hits.filter((h) => /minor/i.test(h.tier)).length,
    major: hits.filter((h) => /major/i.test(h.tier)).length,
    sample: roundsNewestFirst.length,
    pool: roundsNewestFirst[0]?.motherlodePool || 0,
    bySquare,
  }
}
