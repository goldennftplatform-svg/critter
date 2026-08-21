import { ensureFresh, getCache, publicStatus } from './_lib.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()

  await ensureFresh()

  return res.status(200).json({
    success: true,
    data: {
      status: publicStatus(),
      rounds: getCache().rounds,
    },
  })
}
