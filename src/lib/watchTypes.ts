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
  bps: number
  weapon: string | null
  shield: string | null
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
  levelsMax: number
  workhorse: string | null
  masters: WatchMaster[]
  blindSpots: boolean
  nextSteps: WatchStep[]
}

export type WatchPayload = {
  updatedAt: string
  publicOnly: boolean
  spectateUrl: string
  note: string
  wallets: WatchWallet[]
}
