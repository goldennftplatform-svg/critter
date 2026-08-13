import { useEffect, useState, type ReactNode } from 'react'
import './Gate.css'
import { connectWallet, hasWallet } from './lib/wallet'

const IN_KEY = 'critter-in'

type GateData = {
  gated: boolean
  paid: boolean
  prompt?: boolean
  remainingMs: number
  wallet?: string | null
  ip?: string
  entered?: boolean
  connected?: boolean
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function alreadyIn() {
  try {
    return sessionStorage.getItem(IN_KEY) === '1'
  } catch {
    return false
  }
}

function markIn() {
  try {
    sessionStorage.setItem(IN_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function Gate({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GateData | null>(null)
  const [hello, setHello] = useState(false)
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
    load()
      .then((next) => {
        if (next.gated && !alreadyIn()) setHello(true)
      })
      .catch((err) => setNote(err instanceof Error ? err.message : String(err)))
  }, [])

  function dismiss() {
    markIn()
    setHello(false)
  }

  async function onEnter() {
    setBusy(true)
    setNote(null)
    try {
      await load({ action: 'enter' })
      dismiss()
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
      dismiss()
    } finally {
      setBusy(false)
    }
  }

  async function onConnect() {
    setBusy(true)
    setNote(null)
    try {
      const wallet = await connectWallet()
      await load({ action: 'login', wallet })
      dismiss()
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children}

      {data?.gated && data.paid && data.wallet && !hello && (
        <div className="gate-chip paid">{shortAddr(data.wallet)}</div>
      )}

      {hello && (
        <div
          className="gate-veil"
          role="dialog"
          aria-modal="true"
          aria-label="Enter"
          onClick={() => dismiss()}
        >
          <div className="gate-card" onClick={(e) => e.stopPropagation()}>
            <p className="gate-kicker">Critter Three · HQ</p>
            <h2>Come in. The desk is free.</h2>
            <p className="gate-lead">
              Connect a wallet if you have one, or just enter. Lucky Pick and Valdara stay open.
            </p>

            {hasWallet() && (
              <button type="button" className="btn gate-go" onClick={() => onConnect()} disabled={busy}>
                {busy ? 'Wallet…' : 'Connect Phantom / Solflare'}
              </button>
            )}
            <button
              type="button"
              className={hasWallet() ? 'gate-alt' : 'btn gate-go'}
              onClick={() => onEnter()}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Enter free'}
            </button>
            {!hasWallet() && (
              <p className="gate-note">No wallet in this browser — you can still enter free.</p>
            )}
            {note && <p className="gate-note">{note}</p>}
            {data?.ip && <p className="gate-ip">session {data.ip}</p>}
          </div>
        </div>
      )}
    </>
  )
}
