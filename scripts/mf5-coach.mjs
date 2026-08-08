#!/usr/bin/env node
/**
 * MF5 read-only coach — public APIs only, no keys, no txs.
 *
 *   node scripts/mf5-coach.mjs
 *   node scripts/mf5-coach.mjs --wallet <pubkey>
 *
 * Writes data/mf5-coach.md (gitignored via data/).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_WALLET = '66W7hThTvatdN7mgMT5ZAaCbpuMb7Uskun4bAfteQM5F'
const QUEST_MINT = 'QUESTP8xKMfot3ErcdfWXsHbG3kN9mutieAqrVNw74s'
const RPC = 'https://api.mainnet-beta.solana.com'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'data', 'mf5-coach.md')

function argWallet() {
  const i = process.argv.indexOf('--wallet')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return process.env.MF5_WALLET || DEFAULT_WALLET
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return res.json()
}

function attrList(asset) {
  return asset.attributes?.attributeList || []
}

function getAttr(list, key) {
  return list.find((x) => x.key === key)?.value ?? null
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US')
}

async function liquidQuest(wallet) {
  const tok = await rpc('getTokenAccountsByOwner', [
    wallet,
    { mint: QUEST_MINT },
    { encoding: 'jsonParsed' },
  ])
  let sum = 0
  for (const a of tok.result?.value || []) {
    sum += Number(a.account.data.parsed.info.tokenAmount.uiAmount || 0)
  }
  return sum
}

async function bpsByMaster(wallet) {
  const das = await rpc('getAssetsByOwner', {
    ownerAddress: wallet,
    page: 1,
    limit: 1000,
  })
  const map = new Map()
  for (const item of das.result?.items || []) {
    const name = item.content?.metadata?.name || ''
    if (!/^Critters #/.test(name)) continue
    const attrs = item.content?.metadata?.attributes || []
    const bps = Number(
      attrs.find((a) => String(a.trait_type).toUpperCase() === 'BPS')?.value ||
        0,
    )
    if (bps) map.set(name, bps)
  }
  return map
}

async function newestRound() {
  try {
    const j = await fetch('https://mine.critters.quest/api/rounds?limit=1', {
      cache: 'no-store',
    }).then((r) => r.json())
    const r = j.data?.[0]
    if (!r) return null
    return { id: r.round_id, square: (r.winning_square ?? 0) + 1, ts: r.timestamp }
  } catch {
    return null
  }
}

const wallet = argWallet()
const [mastersJson, balJson, liquid, bpsMap, round] = await Promise.all([
  fetch(`https://mine.critters.quest/api/masters?owner=${wallet}`, {
    cache: 'no-store',
  }).then((r) => r.json()),
  rpc('getBalance', [wallet]),
  liquidQuest(wallet),
  bpsByMaster(wallet),
  newestRound(),
])

const masters = (mastersJson.assets || []).map((a) => {
  const list = attrList(a)
  const name = a.name
  return {
    name,
    key: a.publicKey,
    tokens: Number(getAttr(list, 'Tokens') || 0),
    editions: getAttr(list, 'Editions'),
    level: getAttr(list, 'Level'),
    atk: Number(getAttr(list, 'ATK') || 0),
    def: Number(getAttr(list, 'DEF') || 0),
    hp: Number(getAttr(list, 'HP') || 0),
    faction: getAttr(list, 'Faction'),
    bps: bpsMap.get(name) || 0,
    weapon: getAttr(list, 'Weapon'),
    shield: getAttr(list, 'Shield'),
  }
})

masters.sort((a, b) => b.tokens - a.tokens)
const boardQuest = masters.reduce((s, m) => s + m.tokens, 0)
const sol = (balJson.result?.value || 0) / 1e9
const bpsSum = masters.reduce((s, m) => s + m.bps, 0)
const workhorse = [...masters].sort((a, b) => b.atk - a.atk)[0]
const now = new Date().toISOString()

const checks = [
  sol < 0.15
    ? '[ ] CRITICAL: top up SOL (under 0.15) before any town txs'
    : sol < 0.4
      ? '[ ] Top up a bit of SOL for gas (under 0.4)'
      : '[x] SOL looks playable for gas',
  '[ ] Claim BPS SOL if claimable',
  masters.every((m) => m.editions === '0' || m.editions === 0)
    ? '[ ] No clones yet — town Bank drip first, then mint on BPS Masters'
    : '[ ] Check clone mint / royalties',
  workhorse
    ? `[ ] Populate / gather with ${workhorse.name} (ATK ${workhorse.atk}) if town is up`
    : '[ ] Populate a Critter into town',
  '[ ] World Map: send 2 gatherers → claim → re-send',
  '[ ] Swap resources → one Town Hall / Anvil / Bank bump',
  liquid > 0
    ? `[ ] Liquid QUEST ${fmt(liquid)} — consider flexible mine stake`
    : '[x] No liquid QUEST (expected — board-locked)',
  '[ ] Stop. Close tab. Do not YOLO board QUEST into Lucky Pick.',
]

const lines = [
  `# MF5 Coach — ${now}`,
  '',
  `Wallet: \`${wallet}\``,
  '',
  '## Snapshot',
  '',
  `- SOL: **${sol.toFixed(4)}**`,
  `- Board QUEST: **${fmt(boardQuest)}** across ${masters.length} Masters`,
  `- Liquid QUEST: **${fmt(liquid)}**`,
  `- BPS sum (DAS): **${bpsSum ? bpsSum.toFixed(6) + '%' : 'check in-game'}**`,
  round
    ? `- Mine tip: round #${round.id} · sq #${round.square} · ${round.ts}`
    : '- Mine tip: unavailable',
  '',
  '## Masters',
  '',
  '| Master | Board QUEST | BPS | ATK | Faction | Editions |',
  '|---|---:|---:|---:|---|---|',
  ...masters.map(
    (m) =>
      `| ${m.name} | ${fmt(m.tokens)} | ${m.bps ? m.bps.toFixed(4) + '%' : '—'} | ${m.atk} | ${m.faction || '—'} | ${m.editions ?? '—'} |`,
  ),
  '',
  '## Today (he signs — you only coach)',
  '',
  ...checks,
  '',
  'Playbook: docs/MF5-PLAYBOOK.md',
  '',
]

const md = lines.join('\n')
await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, md, 'utf8')
console.log(md)
console.log(`\nWrote ${OUT}`)
