import { getCache, publicStatus, syncRounds } from './_lib.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const cache = getCache()
  if (cache.rounds.length === 0) {
    await syncRounds({ forceFull: true })
  }

  return res.status(200).json({
    success: true,
    data: {
      status: publicStatus(),
      rounds: getCache().rounds,
    },
  })
}
