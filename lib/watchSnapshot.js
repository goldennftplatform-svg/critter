/** Public wallet watch — no keys, no login. Shared by local server + Vercel. */

import { bagYield, quoteFromRounds } from './bps.js'
import {
  boxDesk,
  buildNextSteps,
  getAttr,
  raresFromEquipped,
  scanDasInventory,
} from './intel.js'

export const QUEST_MINT = 'QUESTP8xKMfot3ErcdfWXsHbG3kN9mutieAqrVNw74s'
export const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
/** Official no-login live map (Valdara spectate). */
export const SPECTATE_MAP = 'https://game.critters.quest/?spectate=1'

/** Starter roster — future: DB / opt-in subscribe */
export const WATCHLIST = [
  {
    id: 'mf5',
    label: 'MF5 Whale',
    tagline: '4M board bag · 2× x12 + 4 solos',
    wallet: '66W7hThTvatdN7mgMT5ZAaCbpuMb7Uskun4bAfteQM5F',
  },
  {
    id: 'ussa',
    label: 'USSA',
    tagline: 'Not questing · list gear · clone #2896',
    wallet: 'DRG8hnx8sALBNL6eeq4wV5Ko5dpqc87p5uPMkhpLuSsa',
  },
]

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return res.json()
}

export { buildNextSteps }

export async function snapshotWallet(entry, bpsQuote) {
  const wallet = entry.wallet
  const [mastersJson, balJson, tokJson, dasJson] = await Promise.all([
    fetch(`https://mine.critters.quest/api/masters?owner=${wallet}`, {
      cache: 'no-store',
    }).then((r) => r.json()),
    rpc('getBalance', [wallet]),
    rpc('getTokenAccountsByOwner', [
      wallet,
      { mint: QUEST_MINT },
      { encoding: 'jsonParsed' },
    ]),
    rpc('getAssetsByOwner', {
      ownerAddress: wallet,
      page: 1,
      limit: 1000,
    }),
  ])

  const dasItems = dasJson.result?.items || []
  const inv = scanDasInventory(dasItems)
  const equippedRares = raresFromEquipped(
    (mastersJson.assets || []).map((a) => {
      const list = a.attributes?.attributeList || []
      return {
        name: a.name,
        weapon: getAttr(list, 'Weapon'),
        shield: getAttr(list, 'Shield'),
        hat: getAttr(list, 'Hat'),
        amulet: getAttr(list, 'Amulet'),
        boots: getAttr(list, 'Boots'),
      }
    }),
  )
  const intelRares = []
  const deskPreview = boxDesk(entry.id)
  if (deskPreview?.goldWheelHit) {
    intelRares.push({
      name: 'Gold Wheel Spin',
      slot: 'spent hit',
      stats: 'already pulled',
      on: 'player intel',
      tier: 'legendary',
      why: 'Prize from USSA’s spent box spins — not a leftover ticket',
    })
  }
  if (deskPreview?.listedUnderworld) {
    intelRares.push({
      name: 'Key of the Underworld',
      slot: 'listed',
      stats: 'Death’s Door · clone float',
      on: 'marketplace',
      tier: 'legendary',
      why: 'Idle PvP gear — listed because this Duck is not questing',
    })
  }
  if (deskPreview?.listedShield) {
    intelRares.push({
      name: 'Gold Aegis',
      slot: 'listed',
      stats: 'shield · clone float',
      on: 'marketplace',
      tier: 'epic',
      why: 'Listed with the Key — unused loadout → SOL for clone mint',
    })
  }
  const rareKey = (r) => `${r.on}|${String(r.slot).toLowerCase()}|${r.name}`
  const rareMap = new Map()
  for (const r of [...intelRares, ...inv.rares, ...equippedRares]) {
    if (deskPreview?.listedShield && /gold aegis/i.test(r.name) && r.slot !== 'listed') continue
    rareMap.set(rareKey(r), r)
  }
  const rares = [...rareMap.values()].sort((a, b) => {
    const rank = { legendary: 0, epic: 1, notable: 2 }
    return (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9)
  })

  const bpsMap = new Map()
  const spinsMap = new Map()
  const speciesMap = new Map()
  for (const item of dasItems) {
    const name = item.content?.metadata?.name || ''
    if (!/^Critters #/.test(name)) continue
    const attrs = item.content?.metadata?.attributes || []
    const bps = Number(attrs.find((a) => String(a.trait_type).toUpperCase() === 'BPS')?.value || 0)
    const spins = Number(
      attrs.find((a) => String(a.trait_type) === 'spinsUnlocked')?.value || 0,
    )
    const species = attrs.find((a) => String(a.trait_type) === 'Critter')?.value || null
    if (bps) bpsMap.set(name, bps)
    spinsMap.set(name, spins)
    if (species) speciesMap.set(name, species)
  }

  let liquidQuest = 0
  for (const a of tokJson.result?.value || []) {
    liquidQuest += Number(a.account.data.parsed.info.tokenAmount.uiAmount || 0)
  }

  const masters = (mastersJson.assets || []).map((a) => {
    const list = a.attributes?.attributeList || []
    const name = a.name
    const tokens = Number(getAttr(list, 'Tokens') || 0)
    const editions = Number(getAttr(list, 'Editions') || 0)
    const level = Number(getAttr(list, 'Level') || 0)
    const atk = Number(getAttr(list, 'ATK') || 0)
    return {
      name,
      tokens,
      editions,
      level,
      atk,
      def: Number(getAttr(list, 'DEF') || 0),
      hp: Number(getAttr(list, 'HP') || 0),
      faction: getAttr(list, 'Faction'),
      species: speciesMap.get(name) || getAttr(list, 'Critter'),
      bps: bpsMap.get(name) || 0,
      spinsUnlocked: spinsMap.get(name) || 0,
      weapon: getAttr(list, 'Weapon'),
      shield: getAttr(list, 'Shield'),
      hat: getAttr(list, 'Hat'),
      amulet: getAttr(list, 'Amulet'),
      boots: getAttr(list, 'Boots'),
    }
  })

  masters.sort((a, b) => b.bps - a.bps || b.tokens - a.tokens || b.atk - a.atk)
  const boardQuest = masters.reduce((s, m) => s + m.tokens, 0)
  const editionsTotal = masters.reduce((s, m) => s + m.editions, 0)
  const bpsSum = masters.reduce((s, m) => s + m.bps, 0)
  const levelsMax = masters.reduce((m, x) => Math.max(m, x.level), 0)
  const workhorse = [...masters].sort((a, b) => b.atk - a.atk)[0]?.name || null
  const sol = (balJson.result?.value || 0) / 1e9
  const boxes = boxDesk(entry.id)
  const bpsYield = bpsQuote ? bagYield(bpsSum, bpsQuote) : null

  const snap = {
    id: entry.id,
    label: entry.label,
    tagline: entry.tagline,
    wallet,
    shortWallet: `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
    mapUrl: SPECTATE_MAP,
    updatedAt: new Date().toISOString(),
    sol,
    boardQuest,
    liquidQuest,
    masterCount: masters.length,
    editionsTotal,
    bpsSum,
    bpsYield,
    levelsMax,
    workhorse,
    masters,
    rares,
    towns: inv.towns,
    terron: inv.terron,
    terronTotal: inv.terronTotal,
    terronHotMissing: inv.terronHotMissing,
    pfps: inv.pfps,
    spinsUnlocked: inv.spinsUnlocked,
    boxes,
    blindSpots: true,
  }
  snap.nextSteps = buildNextSteps(snap)
  return snap
}

export async function snapshotWatchlist(list = WATCHLIST) {
  let bpsQuote = quoteFromRounds([])
  try {
    const roundsJson = await fetch('https://mine.critters.quest/api/rounds?limit=200', {
      cache: 'no-store',
    }).then((r) => r.json())
    bpsQuote = quoteFromRounds(roundsJson.data || roundsJson.rounds || [])
  } catch {
    /* live quote optional */
  }

  const wallets = await Promise.all(list.map((e) => snapshotWallet(e, bpsQuote)))
  return {
    updatedAt: new Date().toISOString(),
    publicOnly: true,
    spectateUrl: SPECTATE_MAP,
    note: 'Fan HQ · public chain + player intel. Blind Boxes live on ETH redeem — Solana DAS is full of fake BOX airdrops, ignored.',
    bpsQuote,
    wallets,
  }
}
