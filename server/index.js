import { handleGate, protect } from '../lib/gate.js'
import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const CACHE_FILE = path.join(DATA_DIR, 'rounds.json')
const SOURCE = 'https://mine.critters.quest/api/rounds'
const PORT = Number(process.env.PORT) || 3789
const SYNC_MS = 15_000
const FULL_LIMIT = Number(process.env.ROUNDS_LIMIT) || 5000
const INCR_LIMIT = 200

/**
 * @typedef {{
 *   id: number,
 *   square: number,
 *   ts: string,
 *   deployed: number,
 *   winnings: number,
 *   minted: number,
 *   buyback: number,
 *   outcome: string,
 *   motherlodeTier: string,
 *   motherlodeSol: number,
 *   motherlodeOre: number,
 *   winners: number,
 *   miners: number,
 *   topMiner: string | null,
 *   roundWinner: string | null,
 * }} CachedRound
 */
/** @typedef {{ updatedAt: string | null, source: string, rounds: CachedRound[], lastSyncError: string | null, syncing: boolean }} CacheShape */

/** @type {CacheShape} */
let cache = {
  updatedAt: null,
  source: SOURCE,
  rounds: [],
  lastSyncError: null,
  syncing: false,
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.rounds)) {
      cache = {
        updatedAt: parsed.updatedAt ?? null,
        source: SOURCE,
        rounds: parsed.rounds,
        lastSyncError: null,
        syncing: false,
      }
      console.log(`[cache] loaded ${cache.rounds.length} rounds from disk`)
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
      console.warn('[cache] load failed:', err.message)
    }
  }
}

async function persistCache() {
  await ensureDataDir()
  const payload = {
    updatedAt: cache.updatedAt,
    source: cache.source,
    rounds: cache.rounds,
  }
  await fs.writeFile(CACHE_FILE, JSON.stringify(payload))
}

function slimRound(r) {
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
    motherlodePool: r.sol_motherlode_amount ?? 0,
    winners: r.num_winners ?? 0,
    miners: r.num_miners ?? 0,
    topMiner: r.top_miner ?? null,
    roundWinner: r.round_winner ?? null,
  }
}

async function fetchRemoteRounds(limit = 5000) {
  const url = `${SOURCE}?limit=${limit}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Upstream ${res.status}`)
  const json = await res.json()
  const list = json?.data ?? json?.rounds ?? []
  if (!Array.isArray(list)) throw new Error('Unexpected upstream shape')
  return list.map(slimRound).filter((r) => Number.isFinite(r.id) && Number.isFinite(r.square))
}

function mergeRounds(existing, incoming) {
  const map = new Map()
  for (const r of existing) map.set(r.id, r)
  let added = 0
  let updated = 0
  for (const r of incoming) {
    if (!map.has(r.id)) added += 1
    else updated += 1
    map.set(r.id, r)
  }
  const rounds = [...map.values()].sort((a, b) => b.id - a.id)
  return { rounds, added, updated }
}

async function syncRounds({ forceFull = false } = {}) {
  if (cache.syncing) return { ok: false, reason: 'already_syncing' }
  cache.syncing = true
  try {
    const needDeep =
      forceFull || cache.rounds.length === 0 || cache.rounds.length < FULL_LIMIT * 0.9
    const limit = needDeep ? FULL_LIMIT : INCR_LIMIT
    const incoming = await fetchRemoteRounds(limit)
    const { rounds, added } = mergeRounds(cache.rounds, incoming)

    // If incremental miss (gap), pull deep history once
    if (!needDeep && cache.rounds.length > 0 && added > 0) {
      const newestLocal = cache.rounds[0]?.id ?? 0
      const newestRemote = incoming[0]?.id ?? 0
      const expectedNew = Math.max(0, newestRemote - newestLocal)
      if (added < expectedNew) {
        const full = await fetchRemoteRounds(FULL_LIMIT)
        const merged = mergeRounds(rounds, full)
        cache.rounds = merged.rounds.slice(0, FULL_LIMIT)
      } else {
        cache.rounds = rounds.slice(0, FULL_LIMIT)
      }
    } else {
      cache.rounds = rounds.slice(0, FULL_LIMIT)
    }

    cache.updatedAt = new Date().toISOString()
    cache.lastSyncError = null
    await persistCache()
    console.log(`[sync] ${cache.rounds.length} rounds cached (+${added} this pass)`)
    return { ok: true, count: cache.rounds.length, added }
  } catch (err) {
    cache.lastSyncError = err instanceof Error ? err.message : String(err)
    console.error('[sync] failed:', cache.lastSyncError)
    return { ok: false, reason: cache.lastSyncError }
  } finally {
    cache.syncing = false
  }
}

function publicStatus() {
  const newest = cache.rounds[0]
  const oldest = cache.rounds[cache.rounds.length - 1]
  return {
    updatedAt: cache.updatedAt,
    syncing: cache.syncing,
    lastSyncError: cache.lastSyncError,
    count: cache.rounds.length,
    newestId: newest?.id ?? null,
    oldestId: oldest?.id ?? null,
    newestTs: newest?.ts ?? null,
    source: cache.source,
    localOnly: true,
  }
}

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.all('/api/gate', async (req, res) => {
  try {
    await handleGate(req, res)
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

app.get('/api/status', (_req, res) => {
  res.json({ success: true, data: publicStatus() })
})

app.get('/api/cache', async (req, res) => {
  if (await protect(req, res)) return
  res.json({
    success: true,
    data: {
      status: publicStatus(),
      rounds: cache.rounds,
    },
  })
})

app.post('/api/sync', async (req, res) => {
  if (await protect(req, res)) return
  const forceFull = Boolean(req.body?.full)
  const result = await syncRounds({ forceFull })
  res.json({
    success: result.ok,
    data: { ...publicStatus(), ...result },
  })
})

app.get('/api/watch', async (req, res) => {
  if (await protect(req, res)) return
  try {
    const { snapshotWatchlist, WATCHLIST, mergeWatchlist } = await import('../lib/watchSnapshot.js')
    const id = typeof req.query?.id === 'string' ? req.query.id : null
    const extra = String(req.query?.add || req.query?.wallets || '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4)
    const list = id
      ? WATCHLIST.filter((w) => w.id === id)
      : extra.length
        ? mergeWatchlist(extra)
        : WATCHLIST
    if (id && list.length === 0) {
      return res.status(404).json({ success: false, error: 'unknown wallet id' })
    }
    const data = await snapshotWatchlist(list)
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

app.get('/api/mine', async (req, res) => {
  if (await protect(req, res)) return
  try {
    const { isSolanaAddress } = await import('../lib/watchSnapshot.js')
    const { trackMineWallets } = await import('../lib/mineTrack.js')
    const addrs = String(req.query?.wallet || req.query?.add || req.query?.wallets || '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(isSolanaAddress)
      .slice(0, 4)
    if (!addrs.length) {
      return res.status(400).json({ success: false, error: 'wallet required' })
    }
    const tracks = await trackMineWallets(addrs)
    res.json({ success: true, data: { tracks } })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

// Production: serve built SPA
const dist = path.join(ROOT, 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api).*/, async (req, res, next) => {
  try {
    await fs.access(path.join(dist, 'index.html'))
    res.sendFile(path.join(dist, 'index.html'))
  } catch {
    next()
  }
})

function cacheNeedsEnrichment() {
  const sample = cache.rounds[0]
  return !sample || sample.winnings == null || sample.buyback == null
}

await ensureDataDir()
await loadCache()

app.listen(PORT, async () => {
  console.log(`[block-optimiser] local server http://localhost:${PORT}`)
  await syncRounds({ forceFull: cache.rounds.length === 0 || cacheNeedsEnrichment() })
  setInterval(() => {
    syncRounds().catch(() => {})
  }, SYNC_MS)
})
