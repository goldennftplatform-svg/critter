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

  async function sync(full = false) {
    setSyncing(true)
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
      setSyncing(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await loadCache()
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    const poll = setInterval(() => loadCache().catch(() => {}), 20_000)
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
        <h1 className="brand-mark">BLOCK OPTIMISER</h1>
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

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <h1 className="brand-mark">BLOCK OPTIMISER</h1>
          <span className="brand-tag">Lucky Pick read board</span>
        </div>
        <div className="bar-right">
          <span className={`dot ${status?.syncing || syncing ? 'busy' : 'ok'}`} />
          <span className="meta">
            #{status?.newestId ?? '—'} · {status?.count ?? rounds.length} rounds
          </span>
          <div className="seg" role="group" aria-label="Window">
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
          <button className="btn" onClick={() => sync(false)} disabled={syncing}>
            {syncing ? '…' : 'Sync'}
          </button>
        </div>
      </header>

      {error && <p className="err">{error}</p>}

      <section className="plays">
        <div className="plays-head">
          <div>
            <p className="kicker">Not fin advice — odds &amp; best plays</p>
            <h2>Hit these</h2>
          </div>
          <p className="plays-sub">
            last {analysis.window} · fair {formatPct(fair)} each · last printed #{analysis.lastSquare}
          </p>
        </div>
        <div className="play-row">
          {analysis.picks.map((p) => {
            const dueMult = p.gap / Math.max(expected, 1)
            return (
              <button type="button" className="play" key={p.square}>
                <span className="play-rank">{p.rank}</span>
                <span className="play-num">#{p.square}</span>
                <span className="play-gap">×{dueMult.toFixed(1)} due</span>
                <span className="play-why">{p.reason}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="stage">
        <div className="board-wrap">
          <div className="board-head">
            <h3>Board</h3>
            <span>
              copper = hot · steel = cold · ring = last hit · outline = best play
            </span>
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
                  className={[
                    'sq',
                    isLast ? 'last' : '',
                    isPick ? 'pick' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    background: heatColor(stat.hits, maxHits, expected),
                    animationDelay: `${i * 12}ms`,
                  }}
                  title={`#${display} · ${stat.hits}× · gap ${stat.gap}`}
                >
                  {pickRank != null && <em>{pickRank}</em>}
                  <strong>{display}</strong>
                  <small>{stat.hits}</small>
                </div>
              )
            })}
          </div>
          <div className="tape">
            {analysis.recent.slice(0, 28).map((r) => {
              const n = toDisplay(r.square)
              return (
                <span
                  key={r.id}
                  className={`tick ${n % 2 ? 'odd' : 'even'} ${pickSet.has(n) ? 'is-pick' : ''}`}
                  title={`#${r.id} ${displayOutcome(r)}`}
                >
                  {n}
                </span>
              )
            })}
          </div>
        </div>

        <aside className="rail">
          <div className="last-box">
            <span className="kicker">Last hit</span>
            <div className="last-num">#{analysis.lastSquare}</div>
            <div className="last-line">
              round #{last?.id} · {last ? formatSol(last.deployed, 2) : '—'} SOL ·{' '}
              {last ? displayOutcome(last) : '—'}
            </div>
            <div className="last-line muted">{shortTime(last?.ts ?? null)}</div>
          </div>

          <div className="rail-block">
            <div className="rail-label">
              <span>Hot</span>
              <span>hits</span>
            </div>
            <div className="num-strip">
              {analysis.hot.slice(0, 6).map((s) => (
                <span key={s.square} className="chip hot">
                  <b>{s.square}</b>
                  <i>{s.hits}×</i>
                </span>
              ))}
            </div>
          </div>

          <div className="rail-block">
            <div className="rail-label">
              <span>Due</span>
              <span>gap</span>
            </div>
            <div className="num-strip">
              {analysis.due.slice(0, 6).map((s) => (
                <span key={s.square} className="chip due">
                  <b>{s.square}</b>
                  <i>{s.gap}</i>
                </span>
              ))}
            </div>
          </div>

          <div className="rail-block">
            <div className="rail-label">
              <span>Lean</span>
              <span>vs fair</span>
            </div>
            <div className="leans">
              {leanBuckets.map((b) => {
                const delta = b.share - b.expected
                return (
                  <div className="lean" key={b.key}>
                    <span className="lean-name">
                      {b.label.split(' ')[0]}
                      {b.streak > 1 ? ` ×${b.streak}` : ''}
                    </span>
                    <span className={`lean-val ${delta >= 0 ? 'up' : 'down'}`}>
                      {formatPct(b.share)}
                    </span>
                    <div className="lean-bar">
                      <i style={{ width: `${Math.min(b.share * 100, 100)}%` }} />
                      <em style={{ left: `${b.expected * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </section>

      <section className="feed-toggle">
        <button type="button" className="linkish" onClick={() => setShowFeed((v) => !v)}>
          {showFeed ? 'Hide round feed' : 'Show round feed'}
        </button>
        <span className="muted">
          local cache · not a promise · play on mine.critters.quest
        </span>
      </section>

      {showFeed && (
        <div className="feed">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Sq</th>
                <th>Outcome</th>
                <th>Win</th>
                <th>In</th>
                <th>Out</th>
                <th>QUEST</th>
                <th>🔥</th>
                <th>Trove</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {analysis.recent.map((r) => {
                const outcome = displayOutcome(r)
                const trove = displayMotherlode(r)
                return (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td className="sq-cell">#{toDisplay(r.square)}</td>
                    <td className={outcomeClass(outcome)}>{outcome}</td>
                    <td>{r.winners || '—'}</td>
                    <td>{formatSol(r.deployed, 2)}</td>
                    <td>{formatSol(r.winnings, 2)}</td>
                    <td>{formatQuest(r.minted, 2)}</td>
                    <td>{formatSol(r.buyback, 3)}</td>
                    <td className={trove === '–' ? 'muted' : 'oc-trove'}>{trove}</td>
                    <td className="muted">{shortTime(r.ts)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
