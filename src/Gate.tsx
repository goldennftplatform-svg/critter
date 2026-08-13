import { useEffect, useState, type ReactNode } from 'react'
import './Gate.css'

type PayItem = {
  id: string
  symbol: string
  amount: number
  display: string
  usd: number
  url: string
}

type GateData = {
  gated: boolean
  paid: boolean
  remainingMs: number
  previewMs?: number
  memo?: string | null
  ip?: string
  waiting?: boolean
  credited?: boolean
  checkout?: {
    memo: string
    treasury: string
    usd: number
    days: number
    prices: { sol: number; usdc: number; quest: number; at: string }
    pay: PayItem[]
  }
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function Gate({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GateData | null>(null)
  const [sig, setSig] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function load(extra?: Record<string, string>) {
    const res = await fetch('/api/gate', {
      method: extra ? 'POST' : 'GET',
      headers: extra ? { 'Content-Type': 'application/json' } : undefined,
      body: extra ? JSON.stringify(extra) : undefined,
      credentials: 'same-origin',
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'gate failed')
    setData(json.data)
    return json.data as GateData
  }

  useEffect(() => {
    load().catch((err) => setNote(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    if (!data?.gated || data.paid) return
    const t = setInterval(() => {
      setData((cur) =>
        cur && !cur.paid
          ? { ...cur, remainingMs: Math.max(0, cur.remainingMs - 1000) }
          : cur,
      )
    }, 1000)
    return () => clearInterval(t)
  }, [data?.gated, data?.paid])

  useEffect(() => {
    if (!data?.gated || data.paid) return
    const t = setInterval(() => {
      load().catch(() => {})
    }, 8000)
    return () => clearInterval(t)
  }, [data?.gated, data?.paid])

  async function confirm() {
    setBusy(true)
    setNote(null)
    try {
      const next = await load({ action: 'confirm', sig: sig.trim() })
      if (next.credited) setNote('Pass credited. Desk is unlocked.')
      else if (next.waiting) setNote('Not on-chain yet. Send, then hit Check again.')
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNote('Copied.')
    } catch {
      setNote(text)
    }
  }

  const locked = Boolean(data?.gated && !data.paid && data.remainingMs <= 0)
  const previewing = Boolean(data?.gated && !data.paid && data.remainingMs > 0)
  const pay = data?.checkout

  return (
    <>
      <div className={locked ? 'gate-blur' : undefined}>{children}</div>

      {previewing && (
        <div className="gate-chip">
          Preview {clock(data!.remainingMs)}
        </div>
      )}

      {locked && (
        <div className="gate-veil" role="dialog" aria-modal="true" aria-label="Subscribe">
          <div className="gate-card">
            <p className="gate-kicker">Critter Three · desk pass</p>
            <h2>Keep the board. Pay the table.</h2>
            <p className="gate-lead">
              Preview’s up. <b>${pay?.usd ?? 5} in SOL, USDC, or $QUEST</b> unlocks Lucky Pick +
              Valdara HQ for {pay?.days ?? 30} days. Prices are live-checked when your pass is
              quoted.
            </p>

            {pay && (
              <>
                <div className="gate-oracles">
                  <span>SOL ${pay.prices.sol.toFixed(2)}</span>
                  <span>QUEST ${pay.prices.quest.toFixed(4)}</span>
                  <span>USDC $1.00</span>
                </div>
                <div className="gate-pays">
                  {pay.pay.map((p) => (
                    <a key={p.id} className="gate-pay" href={p.url}>
                      <b>{p.display}</b>
                      <i>${p.usd.toFixed(2)} · {p.symbol}</i>
                    </a>
                  ))}
                </div>
                <button type="button" className="gate-copy" onClick={() => copy(pay.treasury)}>
                  Pay to {pay.treasury.slice(0, 4)}…{pay.treasury.slice(-4)} · copy
                </button>
                <p className="gate-memo">
                  Memo <code>{pay.memo}</code> (Phantom link includes it)
                </p>
              </>
            )}

            <label className="gate-sig">
              Tx signature
              <input
                value={sig}
                onChange={(e) => setSig(e.target.value)}
                placeholder="paste after send"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button type="button" className="btn gate-go" onClick={() => confirm()} disabled={busy}>
              {busy ? 'Checking…' : 'Check payment'}
            </button>
            {note && <p className="gate-note">{note}</p>}
            {data?.ip && <p className="gate-ip">session {data.ip}</p>}
          </div>
        </div>
      )}
    </>
  )
}
