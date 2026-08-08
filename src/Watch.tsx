import { useEffect, useState } from 'react'
import './Watch.css'
import type { WatchPayload, WatchWallet } from './lib/watchTypes'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return Math.round(n).toLocaleString('en-US')
}

function WalletCard({ w }: { w: WatchWallet }) {
  return (
    <article className="wcard">
      <div className="wcard-head">
        <h2>{w.label}</h2>
        <span className="tag">{w.masterCount} masters</span>
      </div>
      <p className="wcard-tagline">{w.tagline}</p>
      <div className="wcard-stats">
        <div>
          <b>{w.sol.toFixed(2)}</b>
          <span>SOL</span>
        </div>
        <div>
          <b>{fmt(w.boardQuest)}</b>
          <span>Board</span>
        </div>
        <div>
          <b>{w.bpsSum > 0 ? `${w.bpsSum.toFixed(2)}%` : '—'}</b>
          <span>BPS</span>
        </div>
        <div>
          <b>{w.editionsTotal}</b>
          <span>Clones</span>
        </div>
      </div>

      <p className="steps-label">Next steps</p>
      <div className="steps">
        {w.nextSteps.slice(0, 5).map((s) => (
          <div className={`step ${s.priority}`} key={s.title}>
            <strong>{s.title}</strong>
            <p>{s.detail}</p>
          </div>
        ))}
      </div>

      {w.masters.length > 0 && (
        <div className="roster" aria-label="Roster">
          {w.masters.map((m) => (
            <div className="rmini" key={m.name}>
              <b>{m.name.replace('Critters ', '')}</b>
              <i>
                <span className="atk">ATK {m.atk}</span>
                {m.bps ? ` · BPS` : ''}
                {m.level ? ` · L${m.level}` : ' · L0'}
              </i>
            </div>
          ))}
        </div>
      )}
      <p className="wcard-foot">{w.shortWallet}</p>
    </article>
  )
}

export default function Watch() {
  const [data, setData] = useState<WatchPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const res = await fetch('/api/watch', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || `Watch ${res.status}`)
      setData(json.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(() => load().catch(() => {}), 60_000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="boot">
        <div className="spinner" />
        <span>Scouting wallets…</span>
      </div>
    )
  }

  return (
    <div className="watch">
      <header className="watch-top">
        <div>
          <p className="eyebrow">Public roster radar</p>
          <h1>WATCH</h1>
          <p className="watch-sub">
            No login. On-chain team + next moves. Town fog stays his problem.
          </p>
        </div>
        <div className="watch-actions">
          <button type="button" className="btn sync" onClick={() => load()} disabled={busy}>
            {busy ? '…' : 'Refresh'}
          </button>
          <a className="btn ghost" href="/">
            ← Optimiser
          </a>
        </div>
      </header>

      {error && <p className="watch-err">{error}</p>}
      {data?.note && <p className="watch-note">{data.note}</p>}

      <div className="watch-stack">
        {data?.wallets.map((w) => (
          <WalletCard key={w.id} w={w} />
        ))}
      </div>

      <section className="watch-saas">
        <h3>Later: opt-in Watch</h3>
        <p>
          Drop a wallet → get a live next-steps board + alerts. You never hand over keys — public
          scoreboard only. Subscribe-style PAaS when we wire waitlist.
        </p>
      </section>
    </div>
  )
}
