import { useEffect, useState } from 'react'
import './Watch.css'
import { BrandBar } from './Brand'
import { fmtSolTiny } from './lib/bps'
import { WalletDesk } from './WalletDesk'
import type { WatchPayload } from './lib/watchTypes'

export default function Watch() {
  const [quote, setQuote] = useState<WatchPayload['bpsQuote'] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [spectate, setSpectate] = useState('https://game.critters.quest/?spectate=1')

  useEffect(() => {
    fetch('/api/watch', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        setQuote(json.data.bpsQuote ?? null)
        setNote(json.data.note ?? null)
        if (json.data.spectateUrl) setSpectate(json.data.spectateUrl)
      })
      .catch(() => {})
  }, [])

  const q = quote

  return (
    <div className="watch">
      <header className="watch-top">
        <div>
          <BrandBar world="valdara" />
          <h1>VALDARA HQ</h1>
          <p className="watch-sub">Pin a wallet or connect Phantom. Same desk as MF5 and USSA.</p>
        </div>
        <div className="watch-actions">
          <a className="btn sync" href={spectate} target="_blank" rel="noreferrer">
            Map
          </a>
        </div>
      </header>

      {q && (
        <section className="bps-strip">
          <div>
            <b>{q.avgRoundSol.toFixed(2)} SOL</b>
            <span>live pot</span>
          </div>
          <div className="hot">
            <b>{fmtSolTiny(q.per001PerRound)}</b>
            <span>per 0.01 BPS / rd</span>
          </div>
          <div>
            <b>{fmtSolTiny(q.per001PerDay)}</b>
            <span>per 0.01 / day</span>
          </div>
          <div>
            <b>{fmtSolTiny(q.per001PerYear)}</b>
            <span>per 0.01 / year</span>
          </div>
        </section>
      )}

      {note && <p className="watch-note">{note}</p>}

      <WalletDesk />
    </div>
  )
}
