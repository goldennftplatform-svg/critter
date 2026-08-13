/** Player-intel boxes live on ETH Blind Box / Gold Wheel — not in Solana DAS spam. */
export const BOX_INTEL = {
  mf5: {
    claimedAll: false,
    multi: 2,
    multiLowEdition: null,
    solos: 4,
    goldWheelHit: false,
    spinsSpent: false,
    listedUnderworld: false,
    listedShield: false,
    notQuesting: false,
    cloneNext: false,
    chain: 'ETH Blind Box (2× x12 + 4 solos)',
  },
  ussa: {
    claimedAll: true,
    multi: 0,
    multiLowEdition: null,
    solos: 0,
    goldWheelHit: true,
    spinsSpent: true,
    listedUnderworld: true,
    listedShield: true,
    notQuesting: true,
    cloneNext: true,
    chain: 'not questing · list Key + Aegis → clone mint',
  },
}

const CQ_ITEM = 'CQitemHGamDdQiSzYp11ifmz588zkPy4rgRJStzAw12q'
const CQ_MASTER = 'CRittErsK51xrVktQeMeAW2cK7JNqv6Ko9Zrw26eF2cT'
const CQ_PFP = 'CQPFP6NzRyv39ii62skPxJMEax3TRix9mwutRRkj3iYT'

const LEGENDARY_RE = /key of the underworld|planet splitter|bag of goodies|celestial core|origin scythe|gold wheel|lucky wedge/i
const EPIC_RE = /gold aegis|emerald tool|perfect gem|town skin/i

export function getAttr(list, key) {
  return list.find((x) => x.key === key)?.value ?? null
}

function attrMap(attrs) {
  const map = {}
  for (const a of attrs || []) {
    const k = String(a.trait_type || a.key || '')
    if (k) map[k] = a.value
  }
  return map
}

function parseGear(raw) {
  if (!raw || raw === 'None' || raw === 'NONE' || raw === 'none') return null
  const m = String(raw).match(/^(.+?)\{([^}]+)\}$/)
  return m ? { name: m[1].trim(), stats: m[2], raw: String(raw) } : { name: String(raw), stats: '', raw: String(raw) }
}

function defFromStats(stats) {
  const m = String(stats).match(/DEF:(-?\d+)/i)
  return m ? Number(m[1]) : 0
}

function atkFromStats(stats) {
  const m = String(stats).match(/ATK:(-?\d+)/i)
  return m ? Number(m[1]) : 0
}

export function classifyItem(name) {
  const blob = String(name || '')
  if (LEGENDARY_RE.test(blob)) return 'legendary'
  if (EPIC_RE.test(blob)) return 'epic'
  return 'notable'
}

export function scanDasInventory(items = []) {
  const rares = []
  const terron = {}
  const towns = []
  let pfps = 0
  let spinsUnlocked = 0

  for (const item of items) {
    const name = item.content?.metadata?.name || ''
    const uri = item.content?.json_uri || ''
    const col = item.grouping?.find((g) => g.group_key === 'collection')?.group_value
    const attrs = item.content?.metadata?.attributes || []
    const map = attrMap(attrs)
    const official = col === CQ_ITEM || col === CQ_MASTER || col === CQ_PFP || /critters\.quest/.test(uri)

    if (col === CQ_PFP || /^Critter PFP #/.test(name)) pfps += 1

    if (/^Terron Shard/.test(name) && official) {
      const n = String(map.Number ?? name.match(/#(\d+)/)?.[1] ?? '?')
      terron[n] = (terron[n] || 0) + 1
    }

    if (/^Town #/.test(name) && official) {
      towns.push({
        name,
        zone: map.Zone || null,
        level: Number(map.Level || 0),
        plot: map.Plot || null,
        bank: map.Bank || null,
        walls: map.Walls || null,
        status: map.Status || null,
        durability: map.Durability || null,
      })
    }

    if (/^Critters #/.test(name)) {
      spinsUnlocked += Number(map.spinsUnlocked || 0)
      for (const slot of ['Weapon', 'Shield', 'Hat', 'Amulet', 'Boots']) {
        const gear = parseGear(map[slot])
        if (!gear) continue
        const tier = classifyItem(gear.name)
        const def = defFromStats(gear.stats)
        const atk = atkFromStats(gear.stats)
        const monsterRoll = def >= 40 || atk >= 40
        if (tier === 'legendary' || tier === 'epic' || monsterRoll) {
          rares.push({
            name: gear.name,
            slot,
            stats: gear.stats,
            on: name,
            tier: tier === 'notable' && monsterRoll ? 'epic' : tier,
            why: monsterRoll && tier === 'notable' ? `Monster roll ${gear.stats}` : `${slot} on ${name}`,
          })
        }
      }
    }

    if (official && LEGENDARY_RE.test(`${name} ${JSON.stringify(map)}`) && !/^Critters #/.test(name)) {
      rares.push({
        name,
        slot: 'item',
        stats: '',
        on: name,
        tier: 'legendary',
        why: 'Official Critters drop',
      })
    }
  }

  const hotMissing = ['0', '8'].filter((n) => !terron[n])
  const terronTotal = Object.values(terron).reduce((s, n) => s + n, 0)

  rares.sort((a, b) => {
    const rank = { legendary: 0, epic: 1, notable: 2 }
    return (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9)
  })

  return {
    rares,
    terron,
    terronTotal,
    terronHotMissing: hotMissing,
    towns,
    pfps,
    spinsUnlocked,
  }
}

export function raresFromEquipped(masters) {
  const rares = []
  for (const m of masters || []) {
    for (const slot of ['weapon', 'shield', 'hat', 'amulet', 'boots']) {
      const raw = m[slot]
      if (!raw || raw === 'None' || raw === 'NONE') continue
      const parsed = String(raw).match(/^(.+?)\{([^}]+)\}$/)
      const name = parsed ? parsed[1].trim() : String(raw)
      const stats = parsed ? parsed[2] : ''
      const tier = classifyItem(name)
      const def = Number(stats.match(/DEF:(-?\d+)/i)?.[1] || 0)
      const atk = Number(stats.match(/ATK:(-?\d+)/i)?.[1] || 0)
      const monsterRoll = def >= 40 || atk >= 40
      if (tier === 'legendary' || tier === 'epic' || monsterRoll) {
        rares.push({
          name,
          slot,
          stats,
          on: m.name,
          tier: tier === 'notable' && monsterRoll ? 'epic' : tier,
          why: monsterRoll && tier === 'notable' ? `Monster roll ${stats}` : `${slot} on ${m.name}`,
        })
      }
    }
  }
  return rares
}

export function boxDesk(id) {
  const intel = BOX_INTEL[id]
  if (!intel) return null

  if (intel.spinsSpent) {
    return {
      ...intel,
      verdict: 'spun-out',
      headline: 'Spins spent · listings fund clones',
      inventory: 'Not questing this Duck. Key + Gold Aegis listed for SOL. Then clone mint on #2896.',
      detail:
        'USSA already used the box spins (Gold Wheel hit printed). He is not running this critter in Valdara, so idle legendary gear is inventory, not a loadout. Listing Key + shield for SOL, then opening a clone mint, is the actual play — not a yolo dump.',
      move: 'Fill the listings. Open clone mint on #2896 (max 15 live). Set SOL price yourself, bonding-curve QUEST off the ~706k board bag, 24h min launch delay. Clones export QUEST faster than Bank L1’s 100/day if this duck never gathers.',
    }
  }

  if (intel.claimedAll) {
    return {
      ...intel,
      verdict: 'claimed',
      headline: 'All boxes already claimed',
      inventory: 'No leftover Blind Box tickets.',
      detail:
        'No leftover Blind Box / Gold Wheel tickets on this wallet. Play is Valdara grind — Bank, gather, tools — not wheel FOMO.',
      move: 'Skip the wheel desk. Rush Town Bank L1 and keep SOL for claims.',
    }
  }

  return {
    ...intel,
    verdict: 'probe-hold',
    headline: 'Probe solos · hold the x12s',
    inventory: `${intel.multi}× x12 cases + ${intel.solos} solos`,
    detail:
      'USSA just printed a Gold Wheel Spin on this table — solos are fair probes right now. Each x12 is 12 box spins + 1 exclusive Limited Edition case spin. Dumping both cases the same night burns the only tickets with a guaranteed LE.',
    move: `Spin 1–2 solos as reads. If Gold Wheel / LE starts printing, you’ve mapped the table. Park both x12 cases for a hotter Gold Wheel week.`,
  }
}

export function buildNextSteps(snap) {
  const steps = []
  const push = (priority, title, detail) => steps.push({ priority, title, detail })

  if (snap.sol < 0.15) {
    push('critical', 'Feed the tank', 'SOL is under 0.15 — nothing signs without gas.')
  } else if (snap.sol < 0.45) {
    push('high', 'Top up SOL', 'Under 0.45 SOL. Keep a buffer for town + claims.')
  }

  if (snap.bpsSum > 0) {
    const y = snap.bpsYield
    const day = y ? `${y.perDay.toFixed(3)} SOL/day est.` : 'passive SOL'
    push('high', 'Claim BPS SOL', `Bag is ${snap.bpsSum.toFixed(3)} BPS · ${day}. Yield is automatic — claiming is the only click that pays.`)
  }

  const desk = snap.boxes
  const idleLister = desk?.notQuesting && desk?.cloneNext

  if (desk?.verdict === 'spun-out') {
    push('mid', desk.headline, desk.move)
    if (idleLister) {
      push(
        'high',
        'Clone mint is the exit',
        'Max 15 clones live. You set SOL price + how much bound QUEST each clone carries (fixed or bonding curve — earlier mints get more). 5% royalty on secondary. Don’t dump all ~706k onto the first wave unless this Master is retired for good.',
      )
    }
  } else if (desk?.verdict === 'probe-hold') {
    push('high', desk.headline, desk.move)
  } else if (desk?.verdict === 'hold-4') {
    push('high', desk.headline, desk.move)
  } else if (desk?.verdict === 'claimed') {
    push('mid', 'Boxes done', desk.detail)
  }

  if (snap.towns?.some((t) => t.bank === 'Locked') && !idleLister) {
    push(
      'high',
      'Unlock Town Bank',
      'Town is placed but Bank is Locked. Bank L1 is 200 QUEST + Wood×10 Stone×8 Clay×3 · 4h. Board QUEST does not spend until it drips.',
    )
  }

  if (snap.terronHotMissing?.length && snap.terronTotal > 0) {
    push(
      'mid',
      'Terron hunt 0 + 8',
      `${snap.terronTotal} shards on-hand, missing #${snap.terronHotMissing.join(' & #')} (Advanced Tool odds). Crack junk numbers; keep hunting 0/8.`,
    )
  }

  if (snap.masterCount === 0) {
    push('critical', 'No Masters visible', 'Wrong wallet or still migrating. Check inventory.')
    const order = { critical: 0, high: 1, mid: 2, low: 3 }
    return steps.sort((a, b) => order[a.priority] - order[b.priority])
  }

  if (snap.editionsTotal === 0) {
    if (idleLister) {
      push(
        'high',
        'Open the clone desk',
        'Editions still 0. Clone Dashboard on #2896 — supply, SOL price, QUEST split, 24h delay. Listings on Key + Aegis are the gas/float so mint txs and a real ask don’t starve the wallet (0.4 SOL is tight).',
      )
    } else {
      push(
        'mid',
        'Clone when Bank drips',
        'Editions still 0. Rush Town Bank, then mint clones on BPS Masters first.',
      )
    }
  }

  if (!idleLister && snap.levelsMax === 0) {
    push(
      'high',
      'Get on the map',
      `Populate ${snap.workhorse || 'a Critter'} → shovel/pick/axe → claim. Levels still 0. Newbie 72h shield is for gathering, not raiding.`,
    )
  } else if (!idleLister && snap.levelsMax < 3) {
    push('mid', 'Keep the gather loop', 'Early levels — 2 gatherers on repeat beats raid FOMO.')
  }

  if (idleLister && snap.boardQuest > 100_000) {
    push(
      'mid',
      'Clones move the 706k',
      `${Math.round(snap.boardQuest).toLocaleString()} QUEST is Master-bound. If this Duck never gathers, bonding-curve clones are the export. Bank L1 is 100/day — skip it until he actually quests.`,
    )
  } else if (snap.liquidQuest <= 0 && snap.boardQuest > 100_000) {
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

  if (!idleLister && snap.rares?.some((r) => /gold aegis/i.test(r.name))) {
    push('low', 'Gold Aegis parked', 'Legendary-tier shield is equipped. That is the tank — don’t strip it for fashion.')
  }

  push(
    'low',
    'Close the tab',
    idleLister
      ? 'Lazy wins. Let listings fill → open clone mint → out.'
      : 'Lazy wins. Claim BPS → send two gatherers → upgrade Bank → out.',
  )

  const order = { critical: 0, high: 1, mid: 2, low: 3 }
  return steps.sort((a, b) => order[a.priority] - order[b.priority])
}
