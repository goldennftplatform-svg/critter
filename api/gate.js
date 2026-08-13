import { handleGate } from '../lib/gate.js'

export default async function handler(req, res) {
  try {
    await handleGate(req, res)
  } catch (err) {
    if (res.headersSent) return
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
