/** Public wallet watch — no keys, no login. Shared by local server + Vercel. */

export const QUEST_MINT = 'QUESTP8xKMfot3ErcdfWXsHbG3kN9mutieAqrVNw74s'
export const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'

/** Starter roster — future: DB / opt-in subscribe */
export const WATCHLIST = [
  {
    id: 'mf5',
    label: 'MF5 Whale',
    tagline: '4M board bag · BPS yield',
    wallet: '66W7hThTvatdN7mgMT5ZAaCbpuMb7Uskun4bAfteQM5F',
  },
  {
    id: 'ussa',
    label: 'USSA',
    tagline: 'Fresh town energy',
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

function getAttr(list, key) {
  return list.find((x) => x.key === key)?.value ?? null
}

export function buildNextSteps(snap) {
  const steps = []
  const push = (priority, title, detail) => steps.push({ priority, title, detail })

  if (snap.sol < 0.15) {
    push('critical', 'Feed the tank', 'SOL is under 0.15 — nothing signs without gas.')
  } else if (snap.sol < 0.4) {
    push('high', 'Top up SOL', 'Under 0.4 SOL. Keep a buffer for town + claims.')
  }

  if (snap.bpsSum > 0) {
    push('high', 'Claim BPS SOL', 'Yield is passive — claiming is the only click that pays.')
  }

  if (snap.masterCount === 0) {
    push('critical', 'No Masters visible', 'Wrong wallet or still migrating. Check inventory.')
    return steps
  }

  if (snap.editionsTotal === 0) {
    push(
      'mid',
      'Clone when Bank drips',
      'Editions still 0. Rush Town Bank, then mint on BPS Masters first.',
    )
  } else {
    push('low', 'Clone engine live', `${snap.editionsTotal} editions on-chain. Keep minting what sells.`)
  }

  if (snap.levelsMax === 0) {
    push(
      'high',
      'Get on the map',
      `Populate ${snap.workhorse || 'a Critter'} → shovel/pick/axe → claim. Levels still 0.`,
    )
  } else if (snap.levelsMax < 3) {
    push('mid', 'Keep the gather loop', 'Early levels — 2 gatherers on repeat beats raid FOMO.')
  } else {
    push('low', 'Progress cooking', `Top level ${snap.levelsMax}. Tools + Bank upgrades next.`)
  }

  if (snap.liquidQuest <= 0 && snap.boardQuest > 100_000) {
    push(
      'mid',
      'Board ≠ Lucky Pick',
      `${Math.round(snap.boardQuest).toLocaleString()} QUEST is Master-bound. Town Bank drip, not mine dump.`,
    )
  } else if (snap.liquidQuest > 0) {
    push(
      'mid',
      'Liquid QUEST spotted',
      `${Math.round(snap.liquidQuest).toLocaleString()} liquid — flexible mine stake is fair game.`,
    )
  }

  if (snap.blindSpots) {
    push(
      'low',
      'Town fog of war',
      'Gather state & Bank level need his login — we only see the on-chain roster.',
    )
  }

  push('low', 'Close the tab', 'Lazy wins. Claim → send two → upgrade one → out.')

  const order = { critical: 0, high: 1, mid: 2, low: 3 }
  return steps.sort((a, b) => order[a.priority] - order[b.priority])
}

export async function snapshotWallet(entry) {
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

  const bpsMap = new Map()
  for (const item of dasJson.result?.items || []) {
    const name = item.content?.metadata?.name || ''
    if (!/^Critters #/.test(name)) continue
    const attrs = item.content?.metadata?.attributes || []
    const bps = Number(
      attrs.find((a) => String(a.trait_type).toUpperCase() === 'BPS')?.value || 0,
    )
    if (bps) bpsMap.set(name, bps)
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
      bps: bpsMap.get(name) || 0,
      weapon: getAttr(list, 'Weapon'),
      shield: getAttr(list, 'Shield'),
    }
  })

  masters.sort((a, b) => b.tokens - a.tokens || b.atk - a.atk)
  const boardQuest = masters.reduce((s, m) => s + m.tokens, 0)
  const editionsTotal = masters.reduce((s, m) => s + m.editions, 0)
  const bpsSum = masters.reduce((s, m) => s + m.bps, 0)
  const levelsMax = masters.reduce((m, x) => Math.max(m, x.level), 0)
  const workhorse = [...masters].sort((a, b) => b.atk - a.atk)[0]?.name || null
  const sol = (balJson.result?.value || 0) / 1e9

  const snap = {
    id: entry.id,
    label: entry.label,
    tagline: entry.tagline,
    wallet,
    shortWallet: `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
    updatedAt: new Date().toISOString(),
    sol,
    boardQuest,
    liquidQuest,
    masterCount: masters.length,
    editionsTotal,
    bpsSum,
    levelsMax,
    workhorse,
    masters: masters.slice(0, 8),
    blindSpots: true,
  }
  snap.nextSteps = buildNextSteps(snap)
  return snap
}

export async function snapshotWatchlist(list = WATCHLIST) {
  const wallets = await Promise.all(list.map((e) => snapshotWallet(e)))
  return {
    updatedAt: new Date().toISOString(),
    publicOnly: true,
    note: 'Town / gather / Bank need his login. This is the on-chain roster scoreboard.',
    wallets,
  }
}
