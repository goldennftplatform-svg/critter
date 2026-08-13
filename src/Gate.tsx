import { useEffect, useState, type ReactNode } from 'react'
import './Gate.css'
import { connectWallet, hasWallet, sendPayTx, signDeskLogin } from './lib/wallet'

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
  wallet?: string | null
  ip?: string
  waiting?: boolean
  credited?: boolean
  connected?: boolean
  tx?: string
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

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function Gate({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GateData | null>(null)
  const [sig, setSig] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [openPay, setOpenPay] = useState(false)

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
      const extra: Record<string, string> = { action: 'confirm' }
      if (data.wallet) extra.wallet = data.wallet
      load(extra).catch(() => {})
    }, 8000)
    return () => clearInterval(t)
  }, [data?.gated, data?.paid, data?.wallet])

  async function onConnect() {
    setBusy(true)
    setNote(null)
    try {
      const wallet = await connectWallet()
      const memo = data?.checkout?.memo || data?.memo || 'C3'
      const signed = await signDeskLogin(wallet, memo)
      const next = await load({
        action: 'login',
        wallet: signed.wallet,
        message: signed.message,
        signature: signed.signature,
      })
      if (next.credited) setNote('Pass found on this wallet. Desk unlocked.')
      else setNote(`Connected ${shortAddr(wallet)}. Pay $5 from this wallet.`)
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function payFromWallet(asset: string) {
    setBusy(true)
    setNote(null)
    try {
      let wallet = data?.wallet || ''
      if (!wallet) {
        wallet = await connectWallet()
        const memo = data?.checkout?.memo || data?.memo || 'C3'
        const signed = await signDeskLogin(wallet, memo)
        await load({
          action: 'login',
          wallet: signed.wallet,
          message: signed.message,
          signature: signed.signature,
        })
      }
      const built = await load({ action: 'paytx', asset, wallet })
      if (!built.tx) throw new Error('Could not build pay tx')
      const signature = await sendPayTx(built.tx)
      setSig(signature)
      const next = await load({ action: 'confirm', sig: signature, wallet })
      if (next.credited) setNote('Pass credited. Desk is unlocked.')
      else setNote('Sent. Waiting for confirm…')
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    setNote(null)
    try {
      const extra: Record<string, string> = { action: 'confirm', sig: sig.trim() }
      if (data?.wallet) extra.wallet = data.wallet
      const next = await load(extra)
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
  const showDesk = locked || openPay
  const pay = data?.checkout
  const wallet = data?.wallet

  return (
    <>
      <div className={locked ? 'gate-blur' : undefined}>{children}</div>

      {previewing && !openPay && (
        <div className="gate-chip">
          <span>Preview {clock(data!.remainingMs)}</span>
          <button type="button" onClick={() => setOpenPay(true)}>
            Connect
          </button>
        </div>
      )}

      {data?.gated && data.paid && data.wallet && (
        <div className="gate-chip paid">{shortAddr(data.wallet)}</div>
      )}

      {showDesk && !data?.paid && (
        <div className="gate-veil" role="dialog" aria-modal="true" aria-label="Subscribe">
          <div className="gate-card">
            <p className="gate-kicker">Critter Three · desk pass</p>
            <h2>Connect wallet. Pay the table.</h2>
            <p className="gate-lead">
              {locked ? "Preview’s up. " : 'Lock in early. '}
              <b>${pay?.usd ?? 5} in SOL, USDC, or $QUEST</b> from your wallet unlocks Lucky Pick +
              Valdara HQ for {pay?.days ?? 30} days. Reconnect later and the pass comes back.
            </p>

            <button
              type="button"
              className="btn gate-go"
              onClick={() => onConnect()}
              disabled={busy}
            >
              {busy ? 'Wallet…' : wallet ? `Connected ${shortAddr(wallet)}` : 'Connect Phantom / Solflare'}
            </button>
            {!hasWallet() && (
              <p className="gate-note">No wallet in this browser — install Phantom, or use a pay link below.</p>
            )}

            {pay && (
              <>
                <div className="gate-oracles">
                  <span>SOL ${pay.prices.sol.toFixed(2)}</span>
                  <span>QUEST ${pay.prices.quest.toFixed(4)}</span>
                  <span>USDC $1.00</span>
                </div>
                <p className="gate-sub">Pay from connected wallet</p>
                <div className="gate-pays">
                  {pay.pay.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="gate-pay"
                      disabled={busy}
                      onClick={() => payFromWallet(p.id)}
                    >
                      <b>{p.display}</b>
                      <i>send {p.symbol}</i>
                    </button>
                  ))}
                </div>
                <p className="gate-sub">Or open a pay link</p>
                <div className="gate-links">
                  {pay.pay.map((p) => (
                    <a key={p.id} href={p.url}>
                      {p.symbol} link
                    </a>
                  ))}
                </div>
                <button type="button" className="gate-copy" onClick={() => copy(pay.treasury)}>
                  Treasury {pay.treasury.slice(0, 4)}…{pay.treasury.slice(-4)} · copy
                </button>
              </>
            )}

            <label className="gate-sig">
              Tx signature
              <input
                value={sig}
                onChange={(e) => setSig(e.target.value)}
                placeholder="paste if you paid from another wallet"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button type="button" className="btn gate-go" onClick={() => confirm()} disabled={busy}>
              {busy ? 'Checking…' : 'Check payment'}
            </button>
            {previewing && (
              <button type="button" className="gate-copy" onClick={() => setOpenPay(false)}>
                Keep previewing
              </button>
            )}
            {note && <p className="gate-note">{note}</p>}
            {data?.ip && <p className="gate-ip">session {data.ip}</p>}
          </div>
        </div>
      )}
    </>
  )
}
