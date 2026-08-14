import { protect } from '../lib/gate.js'
import { isSolanaAddress } from '../lib/watchSnapshot.js'
import { trackMineWallets } from '../lib/mineTrack.js'

function wallets(req) {
  const raw = req.query?.wallet || req.query?.add || req.query?.wallets || ''
  return String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(isSolanaAddress)
    .slice(0, 4)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (await protect(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'GET only' })
  }

  const addrs = wallets(req)
  if (!addrs.length) {
    return res.status(400).json({ success: false, error: 'wallet required' })
  }

  try {
    const tracks = await trackMineWallets(addrs)
    return res.status(200).json({ success: true, data: { tracks } })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
