export type MinePlay = {
  id: number
  square: number
  ts: string
  solIn: number
  solOut: number
  questIn: number
}

export type MineTrack = {
  wallet: string
  sample: number
  rounds: number
  mined: number
  solIn: number
  solOut: number
  questIn: number
  netSol: number
  recent: MinePlay[]
}
