const SOURCE = 'https://mine.critters.quest/api/rounds'

/** @type {{ updatedAt: string | null, lastDeepSyncAt: string | null, rounds: any[], lastSyncError: string | null }} */
const g = globalThis.__critterCache ?? {
  updatedAt: null,
  lastDeepSyncAt: null,
  rounds: [],
  lastSyncError: null,
}
globalThis.__critterCache = g

export function slimRound(r) {
  return {
    id: r.round_id,
    square: r.winning_square,
    ts: r.timestamp,
    deployed: r.total_deployed ?? 0,
    winnings: r.total_winnings ?? 0,
    minted: r.total_minted ?? r.total_ore_reward ?? 0,
    buyback: r.buyback_amount ?? 0,
    outcome: r.lottery_outcome ?? 'Unknown',
    motherlodeTier: r.motherlode_tier ?? 'None',
    motherlodeSol: r.sol_motherlode_payout ?? 0,
    motherlodeOre: r.ore_motherlode_payout ?? 0,
    winners: r.num_winners ?? 0,
    miners: r.num_miners ?? 0,
    topMiner: r.top_miner ?? null,
    roundWinner: r.round_winner ?? null,
  }
}

export async function fetchRemoteRounds(limit = 8000) {
  const res = await fetch(`${SOURCE}?limit=${limit}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Upstream ${res.status}`)
  const json = await res.json()
  const list = json?.data ?? json?.rounds ?? []
  if (!Array.isArray(list)) throw new Error('Unexpected upstream shape')
  return list.map(slimRound).filter((r) => Number.isFinite(r.id) && Number.isFinite(r.square))
}

export function mergeRounds(existing, incoming) {
  const map = new Map()
  for (const r of existing) map.set(r.id, r)
  let added = 0
  for (const r of incoming) {
    if (!map.has(r.id)) added += 1
    map.set(r.id, r)
  }
  return {
    rounds: [...map.values()].sort((a, b) => b.id - a.id),
    added,
  }
}

export function publicStatus() {
  const newest = g.rounds[0]
  const oldest = g.rounds[g.rounds.length - 1]
  return {
    updatedAt: g.updatedAt,
    syncing: false,
    lastSyncError: g.lastSyncError,
    count: g.rounds.length,
    newestId: newest?.id ?? null,
    oldestId: oldest?.id ?? null,
    newestTs: newest?.ts ?? null,
    source: SOURCE,
    localOnly: false,
  }
}

/** Slim cache target. Upstream JSON is fat (~46MB @ 5k) before we slim. */
const FULL_LIMIT = Number(process.env.ROUNDS_LIMIT) || 5000
const INCR_LIMIT = 120
const STALE_MS = 12_000
/** Re-pull deep history if cache is thin or older than this. */
const DEEP_SYNC_MS = 30 * 60_000

export function isCacheStale() {
  if (!g.updatedAt || g.rounds.length === 0) return true
  return Date.now() - new Date(g.updatedAt).getTime() > STALE_MS
}

function needsDeepSync() {
  if (g.rounds.length < FULL_LIMIT * 0.9) return true
  if (!g.updatedAt) return true
  // Deep sync marker lives on the global cache
  const lastDeep = g.lastDeepSyncAt ? new Date(g.lastDeepSyncAt).getTime() : 0
  return Date.now() - lastDeep > DEEP_SYNC_MS
}

export async function syncRounds({ forceFull = false } = {}) {
  try {
    const deep = forceFull || g.rounds.length === 0 || needsDeepSync()
    const limit = deep ? FULL_LIMIT : INCR_LIMIT
    const incoming = await fetchRemoteRounds(limit)
    const { rounds, added } = mergeRounds(g.rounds, incoming)
    g.rounds = rounds.slice(0, FULL_LIMIT)
    g.updatedAt = new Date().toISOString()
    if (deep) g.lastDeepSyncAt = g.updatedAt
    g.lastSyncError = null
    return { ok: true, count: g.rounds.length, added, deep }
  } catch (err) {
    g.lastSyncError = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: g.lastSyncError }
  }
}

/** Cheap refresh used by /api/cache — only hits upstream when stale. */
export async function ensureFresh() {
  if (!isCacheStale() && g.rounds.length >= Math.min(500, FULL_LIMIT)) {
    return { ok: true, skipped: true, count: g.rounds.length }
  }
  return syncRounds({ forceFull: g.rounds.length < FULL_LIMIT * 0.9 })
}

export function getCache() {
  return g
}

export { SOURCE }
