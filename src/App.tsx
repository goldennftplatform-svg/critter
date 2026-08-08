import { useEffect, useState } from 'react'
import './App.css'
import {
  analyze,
  formatPct,
  formatSol,
  shortTime,
  SQUARE_COUNT,
  toDisplay,
} from './lib/analysis'
import {
  displayMotherlode,
  displayOutcome,
  formatQuest,
} from './lib/format'
import type { Analysis, CachedRound, CacheStatus } from './lib/types'

const WINDOWS = [
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '250', value: 250 },
  { label: '500', value: 500 },
  { label: 'ALL', value: 0 },
] as const

const GRID = Array.from({ length: SQUARE_COUNT }, (_, i) => i + 1)

function heatColor(hits: number, maxHits: number, expected: number) {
  if (maxHits <= 0) return 'rgba(38, 31, 24, 0.9)'
  const t = hits / maxHits
  if (hits === 0) return 'rgba(28, 38, 44, 0.95)'
  if (hits < expected * 0.75) {
    const u = hits / Math.max(expected, 1)
    return `rgba(70, 110, 125, ${0.35 + u * 0.35})`
  }
  const r = Math.round(120 + t * 110)
  const g = Math.round(70 + t * 40)
  const b = Math.round(40 + t * 20)
  return `rgba(${r}, ${g}, ${b}, ${0.5 + t * 0.4})`
}

function outcomeClass(label: string) {
  if (label === 'Trove') return 'oc-trove'
  if (label === 'Split') return 'oc-split'
  return 'oc-wallet'
}

export default function App() {
  const [rounds, setRounds] = useState<CachedRound[]>([])
  const [status, setStatus] = useState<CacheStatus | null>(null)
  const [windowSize, setWindowSize] = useState(100)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [showFeed, setShowFeed] = useState(false)

  async function loadCache() {
    const res = await fetch('/api/cache')
    if (!res.ok) throw new Error(`Cache ${res.status}`)
    const json = await res.json()
    setRounds(json.data.rounds ?? [])
    setStatus(json.data.status ?? null)
    setError(json.data.status?.lastSyncError ?? null)
  }

  async function pullFresh(full = false, { quiet = false } = {}) {
    if (!quiet) setSyncing(true)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full }),
      })
      const json = await res.json()
      if (!json.success && json.data?.reason && json.data.reason !== 'already_syncing') {
        setError(json.data.reason)
      }
      await loadCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!quiet) setSyncing(false)
    }
  }

  async function sync(full = false) {
    await pullFresh(full, { quiet: false })
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await pullFresh(false, { quiet: true })
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    // Pull fresh rounds often — Lucky Pick settles ~every minute
    const poll = setInterval(() => {
      pullFresh(false, { quiet: true }).catch(() => {})
    }, 12_000)
    return () => {
      alive = false
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    setAnalysis(analyze(rounds, windowSize))
  }, [rounds, windowSize])

  if (loading) {
    return (
      <div className="boot">
        <div className="spinner" />
        <span>Loading mine cache…</span>
      </div>
    )
  }

  if (!analysis || rounds.length === 0) {
    return (
      <div className="boot">
        <h1 className="logo">BLOCK OPTIMISER</h1>
        <p>No rounds cached yet.</p>
        {error && <p className="err">{error}</p>}
        <button className="btn" onClick={() => sync(true)} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Pull rounds'}
        </button>
      </div>
    )
  }

  const byDisplay = new Map(analysis.squares.map((s) => [s.square, s]))
  const maxHits = Math.max(...analysis.squares.map((s) => s.hits), 1)
  const pickSet = new Set(analysis.picks.map((p) => p.square))
  const fair = 1 / SQUARE_COUNT
  const expected = analysis.squares[0]?.expected || 4
  const last = analysis.recent[0]
  const leanBuckets = [
    ...analysis.patterns.parity,
    ...analysis.patterns.highLow,
    ...analysis.patterns.thirds,
  ]
  const gridLeans = [...analysis.patterns.rows, ...analysis.patterns.cols]
    .map((b) => ({ ...b, delta: b.share - b.expected }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)

  return (
    <div className="app">
      <header className="top">
        <div className="top-main">
          <div>
            <p className="eyebrow">Not fin advice</p>
            <h1 className="logo">BLOCK OPTIMISER</h1>
          </div>
          <button
            className="btn sync"
            onClick={() => sync(false)}
            disabled={syncing}
            aria-label="Sync"
          >
            <span className={`live ${status?.syncing || syncing ? 'busy' : 'ok'}`} />
            {syncing ? '…' : 'Sync'}
          </button>
        </div>
        <div className="top-meta">
          <span>#{status?.newestId ?? '—'}</span>
          <span>{status?.count ?? rounds.length} cached</span>
          <span>last #{analysis.lastSquare}</span>
          <span className="fresh">sync {shortTime(status?.updatedAt ?? null)}</span>
        </div>
        <div className="windows" role="group" aria-label="Window">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              className={windowSize === w.value ? 'on' : ''}
              onClick={() => setWindowSize(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="err">{error}</p>}

      <section className="hero-hit">
        <div className="hero-copy">
          <p className="eyebrow">Last printed</p>
          <div className="hero-num">#{analysis.lastSquare}</div>
          <p className="hero-sub">
            #{last?.id} · {last ? formatSol(last.deployed, 2) : '—'} SOL ·{' '}
            {last ? displayOutcome(last) : '—'}
          </p>
          <p className="hero-time">{shortTime(last?.ts ?? null)}</p>
        </div>
        <div className="hero-stats">
          <div>
            <b>{analysis.window}</b>
            <span>window</span>
          </div>
          <div>
            <b>{formatPct(fair)}</b>
            <span>fair/sq</span>
          </div>
          <div>
            <b>{analysis.picks[0]?.square ?? '—'}</b>
            <span>top play</span>
          </div>
        </div>
      </section>

      <section className="plays">
        <div className="sec-head">
          <h2>Best plays</h2>
          <span>odds &amp; pressure</span>
        </div>
        <div className="play-scroller">
          {analysis.picks.map((p) => {
            const dueMult = p.gap / Math.max(expected, 1)
            return (
              <article className={`play ${p.rank === 1 ? 'top' : ''}`} key={p.square}>
                <span className="play-rank">PLAY {p.rank}</span>
                <strong className="play-num">#{p.square}</strong>
                <span className="play-gap">×{dueMult.toFixed(1)} due</span>
                <p className="play-why">{p.reason}</p>
                <span className="play-meta">
                  {p.hits}× · gap {p.gap}
                </span>
              </article>
            )
          })}
        </div>
      </section>

      <section className="board-sec">
        <div className="sec-head">
          <h2>Board</h2>
          <span>hot · cold · pick ring</span>
        </div>
        <div className="board">
          {GRID.map((display, i) => {
            const stat = byDisplay.get(display)!
            const isLast = analysis.lastSquare === display
            const isPick = pickSet.has(display)
            const pickRank = analysis.picks.find((p) => p.square === display)?.rank
            return (
              <div
                key={display}
                className={['sq', isLast ? 'last' : '', isPick ? 'pick' : '']
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  background: heatColor(stat.hits, maxHits, expected),
                  animationDelay: `${i * 10}ms`,
                }}
              >
                {pickRank != null && <em>{pickRank}</em>}
                <strong>{display}</strong>
                <small>{stat.hits}</small>
              </div>
            )
          })}
        </div>
        <div className="tape">
          {analysis.recent.slice(0, 24).map((r) => {
            const n = toDisplay(r.square)
            return (
              <span
                key={r.id}
                className={`tick ${n % 2 ? 'odd' : 'even'} ${pickSet.has(n) ? 'is-pick' : ''}`}
              >
                {n}
              </span>
            )
          })}
        </div>
      </section>

      <section className="strips">
        <div className="strip">
          <div className="sec-head tight">
            <h2>Hot</h2>
            <span>hits</span>
          </div>
          <div className="chip-row">
            {analysis.hot.slice(0, 6).map((s) => (
              <span key={s.square} className="chip hot">
                <b>{s.square}</b>
                <i>{s.hits}×</i>
              </span>
            ))}
          </div>
        </div>
        <div className="strip">
          <div className="sec-head tight">
            <h2>Due</h2>
            <span>gap</span>
          </div>
          <div className="chip-row">
            {analysis.due.slice(0, 6).map((s) => (
              <span key={s.square} className="chip due">
                <b>{s.square}</b>
                <i>{s.gap}</i>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="leans-sec">
        <div className="sec-head">
          <h2>Lean</h2>
          <span>vs fair share</span>
        </div>
        <div className="leans">
          {leanBuckets.map((b) => {
            const delta = b.share - b.expected
            const short =
              b.key === 't1'
                ? '1–8'
                : b.key === 't2'
                  ? '9–16'
                  : b.key === 't3'
                    ? '17–25'
                    : b.key === 'low'
                      ? 'Low'
                      : b.key === 'high'
                        ? 'High'
                        : b.label
            return (
              <div className="lean" key={b.key}>
                <div className="lean-top">
                  <span>
                    {short}
                    {b.streak > 1 ? ` ×${b.streak}` : ''}
                  </span>
                  <strong className={delta >= 0 ? 'up' : 'down'}>{formatPct(b.share)}</strong>
                </div>
                <div className="lean-bar">
                  <i style={{ width: `${Math.min(b.share * 100, 100)}%` }} />
                  <em style={{ left: `${b.expected * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid-leans">
          {gridLeans.map((b) => (
            <span key={b.key} className={`gchip ${b.delta >= 0 ? 'up' : 'down'}`}>
              <b>{b.label}</b>
              <i>{formatPct(b.share)}</i>
            </span>
          ))}
        </div>
      </section>

      <section className="feed-sec">
        <button type="button" className="feed-btn" onClick={() => setShowFeed((v) => !v)}>
          {showFeed ? 'Hide feed' : 'Round feed'}
          <span>{analysis.recent.length}</span>
        </button>
        <p className="disclaimer">Read board only · play on mine.critters.quest</p>
      </section>

      <footer className="site-foot">
        <a href="/watch">Watch · roster radar</a>
      </footer>

      {showFeed && (
        <>
          <div className="feed-cards">
            {analysis.recent.map((r) => {
              const outcome = displayOutcome(r)
              const trove = displayMotherlode(r)
              return (
                <article className="feed-card" key={r.id}>
                  <div className="fc-top">
                    <strong>#{toDisplay(r.square)}</strong>
                    <span>#{r.id}</span>
                    <span className={outcomeClass(outcome)}>{outcome}</span>
                  </div>
                  <div className="fc-grid">
                    <span>
                      <i>In</i>
                      {formatSol(r.deployed, 2)}
                    </span>
                    <span>
                      <i>Out</i>
                      {formatSol(r.winnings, 2)}
                    </span>
                    <span>
                      <i>QUEST</i>
                      {formatQuest(r.minted, 1)}
                    </span>
                    <span>
                      <i>Buy</i>
                      {formatSol(r.buyback, 3)}
                    </span>
                  </div>
                  <div className="fc-bot">
                    <span className={trove === '–' ? 'muted' : 'oc-trove'}>{trove}</span>
                    <span className="muted">{shortTime(r.ts)}</span>
                  </div>
                </article>
              )
            })}
          </div>
          <div className="feed-table">
            <table>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Sq</th>
                  <th>Outcome</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {analysis.recent.map((r) => {
                  const outcome = displayOutcome(r)
                  return (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td className="sq-cell">#{toDisplay(r.square)}</td>
                      <td className={outcomeClass(outcome)}>{outcome}</td>
                      <td>{formatSol(r.deployed, 2)}</td>
                      <td>{formatSol(r.winnings, 2)}</td>
                      <td className="muted">{shortTime(r.ts)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
