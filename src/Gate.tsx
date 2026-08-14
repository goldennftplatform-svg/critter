import { useEffect, useState, type ReactNode } from 'react'
import './Gate.css'
import { WALLET_EVENT, disconnectWallet, getConnectedWallet } from './lib/wallet'

type GateData = {
  gated: boolean
  paid: boolean
  wallet?: string | null
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function Gate({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GateData | null>(null)
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState<string | null>(null)

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
    load().catch(() => {})
  }, [])

  useEffect(() => {
    function onWallet(e: Event) {
      const addr = (e as CustomEvent<string | null>).detail ?? getConnectedWallet()
      setConnected(addr)
      setData((cur) => (cur ? { ...cur, wallet: addr } : cur))
    }
    window.addEventListener(WALLET_EVENT, onWallet)
    return () => window.removeEventListener(WALLET_EVENT, onWallet)
  }, [])

  async function onDisconnect() {
    setBusy(true)
    try {
      await disconnectWallet()
      await load({ action: 'logout' })
    } catch {
      /* already dropped */
    } finally {
      setBusy(false)
    }
  }

  const wallet = connected

  return (
    <>
      {children}

      {wallet && (
        <div className="gate-chip paid">
          <span>{shortAddr(wallet)}</span>
          <button type="button" onClick={() => onDisconnect()} disabled={busy}>
            {busy ? '…' : 'Disconnect'}
          </button>
        </div>
      )}
    </>
  )
}
