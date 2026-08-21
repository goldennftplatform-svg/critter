import { useEffect, useRef, useState } from 'react'
import { confirmTx, connectWallet, sendPayTx } from './lib/wallet'

export const TREASURY = '5S9tyrZwcgV127fEQMzCaBNWmEKz3iUBdASKaurBSGHU'

const AMOUNTS = [0.02, 0.05, 0.1]

export function DonateButton({
  className,
  treasury = TREASURY,
}: {
  className?: string
  treasury?: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sig, setSig] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function send(sol: number) {
    setBusy(true)
    setNote(null)
    setSig(null)
    try {
      const wallet = await connectWallet({ force: true })
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'donate', wallet, sol, treasury }),
      })
      const json = await res.json()
      if (!json.success || !json.data?.tx) throw new Error(json.error || 'Could not build donate tx')
      const signature = await sendPayTx(json.data.tx)
      setSig(signature)
      setNote('Sent — confirming…')
      const confirmed = await confirmTx(signature)
      setNote(confirmed ? `Confirmed ${sol} SOL. Thank you.` : `Sent ${sol} SOL — still confirming.`)
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="donate-wrap" ref={wrap}>
      <button
        type="button"
        className={className}
        onClick={() => {
          setNote(null)
          setSig(null)
          setOpen((v) => !v)
        }}
        disabled={busy}
      >
        {busy ? 'Wallet…' : 'Donate'}
      </button>
      {open && (
        <div className="donate-menu" role="dialog" aria-label="Donate SOL">
          <p>Send SOL to the desk</p>
          {AMOUNTS.map((sol) => (
            <button key={sol} type="button" disabled={busy} onClick={() => send(sol)}>
              {sol} SOL
            </button>
          ))}
          {note && <p className="donate-note">{note}</p>}
          {sig && (
            <a
              className="donate-note"
              href={`https://solscan.io/tx/${sig}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          )}
        </div>
      )}
    </div>
  )
}
