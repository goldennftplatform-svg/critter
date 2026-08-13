import { protect } from '../lib/gate.js'
import { snapshotWatchlist, WATCHLIST } from '../lib/watchSnapshot.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (await protect(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'GET only' })
  }

  try {
    const id = typeof req.query?.id === 'string' ? req.query.id : null
    const list = id ? WATCHLIST.filter((w) => w.id === id) : WATCHLIST
    if (id && list.length === 0) {
      return res.status(404).json({ success: false, error: 'unknown wallet id' })
    }
    const data = await snapshotWatchlist(list)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
