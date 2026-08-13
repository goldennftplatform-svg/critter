export type WatchStep = {
  priority: 'critical' | 'high' | 'mid' | 'low'
  title: string
  detail: string
}

export type WatchMaster = {
  name: string
  tokens: number
  editions: number
  level: number
  atk: number
  def: number
  hp: number
  faction: string | null
  species?: string | null
  bps: number
  spinsUnlocked?: number
  weapon: string | null
  shield: string | null
  hat?: string | null
  amulet?: string | null
  boots?: string | null
}

export type WatchRare = {
  name: string
  slot: string
  stats: string
  on: string
  tier: 'legendary' | 'epic' | 'notable'
  why: string
}

export type WatchTown = {
  name: string
  zone: string | null
  level: number
  plot: string | null
  bank: string | null
  walls: string | null
  status: string | null
  durability: string | null
}

export type WatchBoxes = {
  claimedAll: boolean
  multi: number
  multiLowEdition: number | null
  solos: number
  goldWheelHit?: boolean
  spinsSpent?: boolean
  listedUnderworld?: boolean
  listedShield?: boolean
  notQuesting?: boolean
  cloneNext?: boolean
  chain: string
  verdict: string
  headline: string
  inventory?: string
  detail: string
  move: string
}

export type BpsYield = {
  bpsSum: number
  perRound: number
  perDay: number
  perYear: number
}

export type BpsQuote = {
  avgRoundSol: number
  poolPerRound: number
  per001PerRound: number
  per001PerDay: number
  per001PerYear: number
  roundsPerDay: number
  sample?: number
  note: string
}

export type WatchWallet = {
  id: string
  label: string
  tagline: string
  wallet: string
  shortWallet: string
  mapUrl: string
  updatedAt: string
  sol: number
  boardQuest: number
  liquidQuest: number
  masterCount: number
  editionsTotal: number
  bpsSum: number
  bpsYield: BpsYield | null
  levelsMax: number
  workhorse: string | null
  masters: WatchMaster[]
  rares: WatchRare[]
  towns: WatchTown[]
  terron: Record<string, number>
  terronTotal: number
  terronHotMissing: string[]
  pfps: number
  spinsUnlocked: number
  boxes: WatchBoxes | null
  blindSpots: boolean
  nextSteps: WatchStep[]
}

export type WatchPayload = {
  updatedAt: string
  publicOnly: boolean
  spectateUrl: string
  note: string
  bpsQuote: BpsQuote
  wallets: WatchWallet[]
}
