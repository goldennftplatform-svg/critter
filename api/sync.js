import { publicStatus, syncRounds } from './_lib.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const forceFull =
    req.method === 'POST'
      ? Boolean(req.body?.full)
      : req.query?.full === '1' || req.query?.full === 'true'

  const result = await syncRounds({ forceFull })
  return res.status(200).json({
    success: result.ok,
    data: { ...publicStatus(), ...result },
  })
}
