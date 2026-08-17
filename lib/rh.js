/** Official pre-announce: Aug 20, short opt-in. Noon ET until they post a clock. */
export const RH_OPENS = Date.parse('2026-08-20T16:00:00.000Z')
export const RH_HOLD = RH_OPENS + 48 * 60 * 60 * 1000
/** Published example only — live % lands with the window. */
export const RH_EST_PCT = 0.25
export const RH_PCTS = [0.1, 0.25, 0.5]

export function rhPhase(now = Date.now()) {
  if (now < RH_OPENS) return 'prep'
  if (now < RH_HOLD) return 'open'
  return 'done'
}

export function rhRemain(now = Date.now()) {
  return Math.max(0, RH_OPENS - now)
}

export function fmtRhClock(ms) {
  if (ms <= 0) return 'NOW'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function rhCommit(board, pct = RH_EST_PCT) {
  return Math.max(0, Number(board) || 0) * pct
}
