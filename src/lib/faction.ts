export function factionHue(faction: string | null | undefined) {
  const f = (faction || '').toLowerCase()
  if (f.includes('verdant')) return 'verdant'
  if (f.includes('sunfire') || f.includes('sun fire')) return 'sunfire'
  if (f.includes('torrent')) return 'torrent'
  if (f.includes('mud')) return 'mudclaw'
  if (f.includes('blood')) return 'bloodmoon'
  return 'plain'
}

export function shortMaster(name: string) {
  return name.replace(/^Critters\s+/, '')
}

export function masterId(name: string) {
  return name.match(/#(\d+)/)?.[1] ?? null
}

/** Official Critters Quest portrait CDN (fan display). */
export function critterPng(name: string) {
  const id = masterId(name)
  return id ? `https://nfts.critters.quest/critters/${id}.png` : ''
}

export function fmtBoard(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return Math.round(n).toLocaleString('en-US')
}
