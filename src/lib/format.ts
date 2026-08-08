import type { CachedRound } from './types'

export const SQUARE_COUNT = 25

/** Site UI uses 1–25; API uses 0–24 */
export function toDisplay(apiSquare: number) {
  return apiSquare + 1
}

export function toApi(displaySquare: number) {
  return displaySquare - 1
}

export function formatSol(lamports: number, digits = 4) {
  return (lamports / 1e9).toFixed(digits)
}

/** QUEST / ORE amounts appear ~1e9 scaled on the feed */
export function formatQuest(raw: number, digits = 4) {
  return (raw / 1e9).toFixed(digits)
}

export function formatPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

export function shortTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function shortWallet(addr: string | null | undefined) {
  if (!addr) return '—'
  if (addr.length < 10) return addr
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

/** Match mine.critters.quest outcome column */
export function displayOutcome(r: CachedRound) {
  const raw = r.outcome || ''
  if (raw === 'Motherlode' || raw.toLowerCase() === 'trove') return 'Trove'
  if (raw === 'Split') return 'Split'
  if (raw === 'Single Winner') {
    return shortWallet(r.roundWinner || r.topMiner)
  }
  // Already a wallet-ish fallback
  if (raw.length > 20) return shortWallet(raw)
  return raw || '—'
}

export function displayMotherlode(r: CachedRound) {
  const tier = r.motherlodeTier
  if (!tier || tier === 'None' || tier === 'none') return '–'
  return tier.includes('TROVE') || tier.includes('Trove') ? tier : `${tier} TROVE`
}
