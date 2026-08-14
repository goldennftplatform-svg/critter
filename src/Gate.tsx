import { useEffect, useState, type ReactNode } from 'react'
import './Gate.css'
import { WALLET_EVENT, disconnectWallet, getConnectedWallet } from './lib/wallet'

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

async function gateCall(extra?: Record<string, string>) {
  const res = await fetch('/api/gate', {
    method: extra ? 'POST' : 'GET',
    headers: extra ? { 'Content-Type': 'application/json' } : undefined,
    body: extra ? JSON.stringify(extra) : undefined,
    credentials: 'same-origin',
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'gate failed')
}

export function Gate({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState<string | null>(null)

  useEffect(() => {
    gateCall().catch(() => {})
  }, [])

  useEffect(() => {
    function onWallet(e: Event) {
      setConnected((e as CustomEvent<string | null>).detail ?? getConnectedWallet())
    }
    window.addEventListener(WALLET_EVENT, onWallet)
    return () => window.removeEventListener(WALLET_EVENT, onWallet)
  }, [])

  async function onDisconnect() {
    setBusy(true)
    try {
      await disconnectWallet()
      await gateCall({ action: 'logout' })
    } catch {
      /* already dropped */
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children}

      {connected && (
        <div className="gate-chip paid">
          <span>{shortAddr(connected)}</span>
          <button type="button" onClick={() => onDisconnect()} disabled={busy}>
            {busy ? '…' : 'Disconnect'}
          </button>
        </div>
      )}
    </>
  )
}
