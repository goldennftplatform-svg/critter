import { getCache, publicStatus, syncRounds } from './_lib.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (getCache().rounds.length === 0) {
    await syncRounds({ forceFull: true })
  }

  return res.status(200).json({
    success: true,
    data: publicStatus(),
  })
}
