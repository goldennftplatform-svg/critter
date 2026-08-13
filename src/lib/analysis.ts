import { SQUARE_COUNT, toDisplay } from './format'
import type { Analysis, CachedRound, PatternBucket, SquareStat } from './types'

/** Display squares 1–25 (matches mine.critters.quest) */
export const DISPLAY_SQUARES = Array.from({ length: SQUARE_COUNT }, (_, i) => i + 1)

export function squareRow(display: number) {
  return Math.floor((display - 1) / 5)
}
export function squareCol(display: number) {
  return (display - 1) % 5
}

/** Odd/even on the site number (1 odd, 2 even) */
export function parityOf(display: number): 'even' | 'odd' {
  return display % 2 === 0 ? 'even' : 'odd'
}

export function thirdOf(display: number): 't1' | 't2' | 't3' {
  if (display <= 8) return 't1'
  if (display <= 16) return 't2'
  return 't3'
}

export function highLowOf(display: number): 'low' | 'high' {
  return display <= 12 ? 'low' : 'high'
}

/** Center 3×3 on the 1–25 board: 7–9, 12–14, 17–19 */
export const INSIDE_SQUARES = [7, 8, 9, 12, 13, 14, 17, 18, 19] as const
const INSIDE_SET = new Set<number>(INSIDE_SQUARES)

export function ringOf(display: number): 'inside' | 'outside' {
  return INSIDE_SET.has(display) ? 'inside' : 'outside'
}

export function isInside(display: number) {
  return INSIDE_SET.has(display)
}

function streakFor(
  roundsNewestFirst: CachedRound[],
  pred: (display: number) => boolean,
): number {
  let n = 0
  for (const r of roundsNewestFirst) {
    if (!pred(toDisplay(r.square))) break
    n += 1
  }
  return n
}

function bucket(
  key: string,
  label: string,
  displaySquares: number[],
  windowRounds: CachedRound[],
  allNewestFirst: CachedRound[],
): PatternBucket {
  const set = new Set(displaySquares)
  const hits = windowRounds.reduce(
    (acc, r) => acc + (set.has(toDisplay(r.square)) ? 1 : 0),
    0,
  )
  const total = windowRounds.length || 1
  const expected = displaySquares.length / SQUARE_COUNT
  const share = hits / total
  return {
    key,
    label,
    hits,
    share,
    expected,
    delta: share - expected,
    streak: streakFor(allNewestFirst, (s) => set.has(s)),
    squares: displaySquares,
  }
}

export function analyze(roundsNewestFirst: CachedRound[], windowSize: number): Analysis {
  const totalAvailable = roundsNewestFirst.length
  const window = Math.min(windowSize === 0 ? totalAvailable : windowSize, totalAvailable)
  const slice = roundsNewestFirst.slice(0, window)
  const expected = window / SQUARE_COUNT

  const hits = new Array(SQUARE_COUNT).fill(0) as number[]
  const lastSeenIndex = new Array(SQUARE_COUNT).fill(-1) as number[]
  const lastRoundId = new Array(SQUARE_COUNT).fill(null) as (number | null)[]
  const lastTs = new Array(SQUARE_COUNT).fill(null) as (string | null)[]

  slice.forEach((r, idx) => {
    if (r.square < 0 || r.square >= SQUARE_COUNT) return
    hits[r.square] += 1
    if (lastSeenIndex[r.square] === -1) {
      lastSeenIndex[r.square] = idx
      lastRoundId[r.square] = r.id
      lastTs[r.square] = r.ts
    }
  })

  const squares: SquareStat[] = DISPLAY_SQUARES.map((display) => {
    const api = display - 1
    const h = hits[api]
    const gap = lastSeenIndex[api] === -1 ? window : lastSeenIndex[api]
    const frequency = window ? h / window : 0
    const dueScore = gap / Math.max(expected, 1) + (expected - h) / Math.max(expected, 1)
    return {
      square: display,
      apiSquare: api,
      hits: h,
      frequency,
      expected,
      delta: h - expected,
      gap,
      dueScore,
      lastRoundId: lastRoundId[api],
      lastTs: lastTs[api],
    }
  })

  const hot = [...squares].sort((a, b) => b.hits - a.hits || a.gap - b.gap).slice(0, 8)
  const due = [...squares].sort((a, b) => b.dueScore - a.dueScore || b.gap - a.gap).slice(0, 8)
  const cold = [...squares].sort((a, b) => b.gap - a.gap || a.hits - b.hits).slice(0, 8)

  const picks = [...squares]
    .map((s) => {
      const justHit = s.gap === 0 ? -3 : 0
      const underHit = (expected - s.hits) / Math.max(expected, 1)
      const score =
        s.dueScore * 1.2 + underHit * 0.8 + (s.gap >= expected ? 0.5 : 0) + justHit
      let reason = `gap ${s.gap}, ${s.hits}× in window`
      if (s.hits === 0) reason = `ice cold — 0 hits in last ${window}`
      else if (s.gap >= expected * 8) reason = `overdue — silent ${s.gap} rounds`
      else if (s.hits < expected * 0.6 && s.gap >= expected * 4)
        reason = `under-hit + gap ${s.gap}`
      else if (s.hits > expected * 1.4 && s.gap >= expected * 4)
        reason = `hot & cooling — ${s.hits}×, gap ${s.gap}`
      return { rank: 0, square: s.square, reason, gap: s.gap, hits: s.hits, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  const t1 = DISPLAY_SQUARES.filter((n) => thirdOf(n) === 't1')
  const t2 = DISPLAY_SQUARES.filter((n) => thirdOf(n) === 't2')
  const t3 = DISPLAY_SQUARES.filter((n) => thirdOf(n) === 't3')
  const lows = DISPLAY_SQUARES.filter((n) => highLowOf(n) === 'low')
  const highs = DISPLAY_SQUARES.filter((n) => highLowOf(n) === 'high')
  const evens = DISPLAY_SQUARES.filter((n) => parityOf(n) === 'even')
  const odds = DISPLAY_SQUARES.filter((n) => parityOf(n) === 'odd')
  const insides = DISPLAY_SQUARES.filter((n) => ringOf(n) === 'inside')
  const outsides = DISPLAY_SQUARES.filter((n) => ringOf(n) === 'outside')

  const patterns = {
    parity: [
      bucket('odd', 'Odd', odds, slice, roundsNewestFirst),
      bucket('even', 'Even', evens, slice, roundsNewestFirst),
    ],
    thirds: [
      bucket('t1', '1st third (1–8)', t1, slice, roundsNewestFirst),
      bucket('t2', '2nd third (9–16)', t2, slice, roundsNewestFirst),
      bucket('t3', '3rd third (17–25)', t3, slice, roundsNewestFirst),
    ],
    highLow: [
      bucket('low', 'Low (1–12)', lows, slice, roundsNewestFirst),
      bucket('high', 'High (13–25)', highs, slice, roundsNewestFirst),
    ],
    ring: [
      bucket('inside', 'Inside (center 9)', insides, slice, roundsNewestFirst),
      bucket('outside', 'Outside (rim 16)', outsides, slice, roundsNewestFirst),
    ],
    rows: [0, 1, 2, 3, 4].map((row) =>
      bucket(
        `r${row}`,
        `Row ${row + 1}`,
        DISPLAY_SQUARES.filter((n) => squareRow(n) === row),
        slice,
        roundsNewestFirst,
      ),
    ),
    cols: [0, 1, 2, 3, 4].map((col) =>
      bucket(
        `c${col}`,
        `Col ${col + 1}`,
        DISPLAY_SQUARES.filter((n) => squareCol(n) === col),
        slice,
        roundsNewestFirst,
      ),
    ),
  }

  return {
    window,
    total: totalAvailable,
    squares,
    hot,
    due,
    cold,
    picks,
    patterns,
    recent: roundsNewestFirst.slice(0, 80),
    lastSquare: roundsNewestFirst[0] != null ? toDisplay(roundsNewestFirst[0].square) : null,
  }
}

export { formatPct, formatSol, shortTime, SQUARE_COUNT, toDisplay } from './format'
