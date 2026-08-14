/** Opt-in Lucky Pick wallet track — SOL in/out + QUEST from mine rounds. */

const SOURCE = 'https://mine.critters.quest/api/rounds'
const LIVE_LIMIT = 500
const LIVE_TTL_MS = 25_000

function liveMem() {
  const g = globalThis
  if (!g.__critterMineLive) g.__critterMineLive = { at: 0, rounds: [] }
  return g.__critterMineLive
}

export function slimPlay(w) {
  const m = String(w?.miner || '').trim()
  if (!m) return null
  return {
    m,
    i: Number(w.deployed_amount || 0),
    o: Number(w.total_sol_rewards || w.sol_reward || 0),
    q: Number(w.total_ore_rewards || 0),
  }
}

function roundFromRemote(r) {
  return {
    id: r.round_id,
    square: r.winning_square,
    ts: r.timestamp,
    plays: (r.winners || []).map(slimPlay).filter(Boolean),
  }
}

export async function fetchMineRounds(limit = LIVE_LIMIT) {
  const mem = liveMem()
  if (mem.rounds.length && Date.now() - mem.at < LIVE_TTL_MS) return mem.rounds
  const res = await fetch(`${SOURCE}?limit=${limit}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Mine ${res.status}`)
  const json = await res.json()
  const list = json?.data ?? json?.rounds ?? []
  if (!Array.isArray(list)) throw new Error('Unexpected mine shape')
  mem.rounds = list.map(roundFromRemote).filter((r) => Number.isFinite(r.id))
  mem.at = Date.now()
  return mem.rounds
}

export function playsForWallet(rounds, wallet) {
  const plays = []
  for (const r of rounds) {
    const hit = (r.plays || []).find((p) => p.m === wallet)
    if (!hit) continue
    plays.push({
      id: r.id,
      square: r.square,
      ts: r.ts,
      solIn: hit.i,
      solOut: hit.o,
      questIn: hit.q,
    })
  }
  return plays
}

export function summarizeMine(plays, wallet, sample) {
  let solIn = 0
  let solOut = 0
  let questIn = 0
  let mined = 0
  for (const p of plays) {
    solIn += p.solIn
    solOut += p.solOut
    questIn += p.questIn
    if (p.solIn > 0) mined += 1
  }
  return {
    wallet,
    sample,
    rounds: plays.length,
    mined,
    solIn,
    solOut,
    questIn,
    netSol: solOut - solIn,
    recent: plays.slice(0, 14),
  }
}

export async function trackMineWallet(wallet) {
  const rounds = await fetchMineRounds()
  const plays = playsForWallet(rounds, wallet)
  return summarizeMine(plays, wallet, rounds.length)
}

export async function trackMineWallets(addrs) {
  const uniq = [...new Set(addrs.map((a) => String(a || '').trim()).filter(Boolean))]
  if (!uniq.length) return []
  const rounds = await fetchMineRounds()
  return uniq.map((wallet) => summarizeMine(playsForWallet(rounds, wallet), wallet, rounds.length))
}
