const SOURCE = 'https://mine.critters.quest/api/rounds'

/** @type {{ updatedAt: string | null, rounds: any[], lastSyncError: string | null }} */
const g = globalThis.__critterCache ?? {
  updatedAt: null,
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

/** Upstream payloads are fat (winners arrays). Cap hard on serverless. */
const FULL_LIMIT = Number(process.env.ROUNDS_LIMIT) || 500
const INCR_LIMIT = 120

export async function syncRounds({ forceFull = false } = {}) {
  try {
    const limit = forceFull || g.rounds.length === 0 ? FULL_LIMIT : INCR_LIMIT
    const incoming = await fetchRemoteRounds(limit)
    const { rounds, added } = mergeRounds(g.rounds, incoming)
    // Keep memory bounded on warm lambdas
    g.rounds = rounds.slice(0, FULL_LIMIT)
    g.updatedAt = new Date().toISOString()
    g.lastSyncError = null
    return { ok: true, count: g.rounds.length, added }
  } catch (err) {
    g.lastSyncError = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: g.lastSyncError }
  }
}

export function getCache() {
  return g
}

export { SOURCE }
