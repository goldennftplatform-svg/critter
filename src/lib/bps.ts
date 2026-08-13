/** 1% of every Lucky Pick round SOL is shared by BPS Masters. */
export const BPS_POOL_FRAC = 0.01
export const BPS_TOTAL_UNITS = 100
export const ROUNDS_PER_DAY = 1440

export type BpsQuote = {
  avgRoundSol: number
  poolPerRound: number
  per001PerRound: number
  per001PerDay: number
  per001PerYear: number
  roundsPerDay: number
  sample?: number
  note: string
}

export function quoteBps(avgRoundSol: number): BpsQuote {
  const pot = Math.max(Number(avgRoundSol) || 0, 0)
  const pool = pot * BPS_POOL_FRAC
  const perRound = pool * (0.01 / BPS_TOTAL_UNITS)
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

export function quoteFromDeployed(deployedLamports: number[]): BpsQuote {
  const sols = deployedLamports.map((n) => Number(n || 0) / 1e9)
  const avg = sols.length === 0 ? 0 : sols.reduce((s, n) => s + n, 0) / sols.length
  return { ...quoteBps(avg), sample: sols.length }
}

export function fmtSolTiny(n: number) {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 1) return n.toFixed(3)
  if (n >= 0.01) return n.toFixed(4)
  if (n >= 0.0001) return n.toFixed(6)
  return n.toFixed(8)
}
