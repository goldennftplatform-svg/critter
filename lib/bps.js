/** 1% of every Lucky Pick round SOL is shared by BPS Masters. */
export const BPS_POOL_FRAC = 0.01
/** Trait looks like 0.05 — treated as 0.05 / 100 of the 1% pool (traits ~sum to 100). */
export const BPS_TOTAL_UNITS = 100
export const ROUNDS_PER_DAY = 1440

export function lamportsToSol(n) {
  return Number(n || 0) / 1e9
}

export function quoteBps(avgRoundSol) {
  const pot = Math.max(Number(avgRoundSol) || 0, 0)
  const pool = pot * BPS_POOL_FRAC
  const per001Share = 0.01 / BPS_TOTAL_UNITS
  const perRound = pool * per001Share
  return {
    avgRoundSol: pot,
    poolPerRound: pool,
    per001PerRound: perRound,
    per001PerDay: perRound * ROUNDS_PER_DAY,
    per001PerYear: perRound * ROUNDS_PER_DAY * 365,
    roundsPerDay: ROUNDS_PER_DAY,
    note: 'Est. 0.01 BPS = 0.01% of the 1% Lucky Pick SOL pool. Pots move; this is not a guarantee.',
  }
}

export function bagYield(bpsSum, quote) {
  const units = Number(bpsSum) || 0
  const mult = units / 0.01
  return {
    bpsSum: units,
    perRound: quote.per001PerRound * mult,
    perDay: quote.per001PerDay * mult,
    perYear: quote.per001PerYear * mult,
  }
}

export function quoteFromRounds(rounds) {
  const sample = (rounds || []).slice(0, 200)
  const avg =
    sample.length === 0
      ? 0
      : sample.reduce((s, r) => s + lamportsToSol(r.total_deployed ?? r.deployed ?? 0), 0) /
        sample.length
  return { ...quoteBps(avg), sample: sample.length }
}
