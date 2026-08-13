import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import './App.css'
import { BrandBar } from './Brand'
import {
  analyze,
  formatPct,
  formatSol,
  isInside,
  shortTime,
  SQUARE_COUNT,
  toDisplay,
} from './lib/analysis'
import { fmtSolTiny, quoteFromDeployed } from './lib/bps'
import {
  displayMotherlode,
  displayOutcome,
  formatQuest,
} from './lib/format'
import type { Analysis, CachedRound, CacheStatus } from './lib/types'
import type { WatchPayload } from './lib/watchTypes'

const WINDOWS = [
  { label: '100', value: 100 },
  { label: '250', value: 250 },
  { label: '500', value: 500 },
  { label: '1k', value: 1000 },
  { label: '2.5k', value: 2500 },
  { label: '5k', value: 5000 },
  { label: 'ALL', value: 0 },
] as const

const GRID = Array.from({ length: SQUARE_COUNT }, (_, i) => i + 1)

/** 0–1 heat stretched across this window's hit counts so the board actually moves when you change 100 / 500 / ALL. */
function heatT(hits: number, minHits: number, maxHits: number) {
  if (maxHits <= 0) return 0
  if (maxHits === minHits) return hits > 0 ? 1 : 0
  return Math.min(Math.max((hits - minHits) / (maxHits - minHits), 0), 1)
}

function outcomeClass(label: string) {
  if (label === 'Trove') return 'oc-trove'
  if (label === 'Split') return 'oc-split'
  return 'oc-wallet'
}

export default function App() {
  const [rounds, setRounds] = useState<CachedRound[]>([])
  const [status, setStatus] = useState<CacheStatus | null>(null)
  const [windowSize, setWindowSize] = useState(500)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [showFeed, setShowFeed] = useState(false)
  const [watch, setWatch] = useState<WatchPayload | null>(null)

  async function loadCache() {
    const res = await fetch('/api/cache')
    if (res.status === 402) return
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
    fetch('/api/watch', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.success) setWatch(j.data)
      })
      .catch(() => {})
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

  const bpsQuote = useMemo(() => {
    const sample = rounds.slice(0, windowSize || rounds.length).slice(0, 200)
    return quoteFromDeployed(sample.map((r) => r.deployed))
  }, [rounds, windowSize])
  const mf5 = watch?.wallets.find((w) => w.id === 'mf5')

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
        <h1 className="logo">LUCKY PICK</h1>
        <p>No rounds cached yet.</p>
        {error && <p className="err">{error}</p>}
        <button className="btn" onClick={() => sync(true)} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Pull rounds'}
        </button>
      </div>
    )
  }

  const byDisplay = new Map(analysis.squares.map((s) => [s.square, s]))
  const hitCounts = analysis.squares.map((s) => s.hits)
  const maxHits = Math.max(...hitCounts, 1)
  const minHits = Math.min(...hitCounts)
  const pickSet = new Set(analysis.picks.map((p) => p.square))
  const expected = analysis.squares[0]?.expected || 4
  const last = analysis.recent[0]
  const [inside, outside] = analysis.patterns.ring
  const leanBuckets = [
    ...analysis.patterns.parity,
    ...analysis.patterns.highLow,
    ...analysis.patterns.thirds,
  ]
  const gridLeans = [...analysis.patterns.rows, ...analysis.patterns.cols]
    .map((b) => ({ ...b, delta: b.share - b.expected }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)

  return (
    <div className="app">
      <header className="top">
        <BrandBar world="mine" />
        <div className="top-main">
          <div>
            <p className="eyebrow">Not fin advice · fan terminal</p>
            <h1 className="logo">LUCKY PICK</h1>
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

      <section className="bps-desk">
        <div className="sec-head">
          <h2>BPS yield desk</h2>
          <span>1% of every round · forever · no stake</span>
        </div>
        <div className="bps-grid">
          <div>
            <b>{bpsQuote.avgRoundSol.toFixed(2)}</b>
            <span>avg pot SOL</span>
          </div>
          <div>
            <b>{fmtSolTiny(bpsQuote.poolPerRound)}</b>
            <span>1% pool / rd</span>
          </div>
          <div className="bps-hot">
            <b>{fmtSolTiny(bpsQuote.per001PerRound)}</b>
            <span>per 0.01 BPS / rd</span>
          </div>
          <div>
            <b>{fmtSolTiny(bpsQuote.per001PerDay)}</b>
            <span>per 0.01 / day</span>
          </div>
          <div>
            <b>{fmtSolTiny(bpsQuote.per001PerYear)}</b>
            <span>per 0.01 / year</span>
          </div>
          <div>
            <b>
              {mf5
                ? `${fmtSolTiny(mf5.bpsYield?.perDay ?? 0)}`
                : '—'}
            </b>
            <span>MF5 bag / day</span>
          </div>
        </div>
        <p className="bps-note">
          {bpsQuote.note}
          {mf5
            ? ` MF5 holds ${mf5.bpsSum.toFixed(3)} BPS ≈ ${fmtSolTiny(mf5.bpsYield?.perYear ?? 0)} SOL/yr at this pot.`
            : ''}{' '}
          Live table from last {bpsQuote.sample ?? 0} rounds.
        </p>
      </section>

      <section className="hero-hit">
        <div className="hero-copy">
          <p className="eyebrow">Last printed</p>
          <div className="hero-num">#{analysis.lastSquare}</div>
          <p className="hero-sub">
            #{last?.id} · {last ? formatSol(last.deployed, 2) : '—'} SOL ·{' '}
            {last ? displayOutcome(last) : '—'}
            {analysis.lastSquare != null
              ? ` · ${isInside(analysis.lastSquare) ? 'IN' : 'OUT'}`
              : ''}
          </p>
          <p className="hero-time">{shortTime(last?.ts ?? null)}</p>
        </div>
        <div className="hero-stats">
          <div>
            <b>{analysis.window}</b>
            <span>window</span>
          </div>
          <div>
            <b>{status?.count ?? rounds.length}</b>
            <span>cached</span>
          </div>
          <div>
            <b>{analysis.picks[0]?.square ?? '—'}</b>
            <span>top play</span>
          </div>
        </div>
      </section>

      <section className="ring-sec">
        <div className="sec-head">
          <h2>Inside / Outside</h2>
          <span>center 9 vs rim 16 · fair {formatPct(9 / 25)} / {formatPct(16 / 25)}</span>
        </div>
        <div className="ring-duo">
          {[inside, outside].map((b) => {
            const delta = b.share - b.expected
            return (
              <div className={`ring-card ${b.key}`} key={b.key}>
                <span className="ring-label">{b.key === 'inside' ? 'Inside' : 'Outside'}</span>
                <strong className={delta >= 0 ? 'up' : 'down'}>{formatPct(b.share)}</strong>
                <span className="ring-meta">
                  {b.hits}× · fair {formatPct(b.expected)}
                  {b.streak > 1 ? ` · streak ×${b.streak}` : ''}
                </span>
                <div className="lean-bar">
                  <i style={{ width: `${Math.min(b.share * 100, 100)}%` }} />
                  <em style={{ left: `${b.expected * 100}%` }} />
                </div>
              </div>
            )
          })}
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
          <h2>Lucky table</h2>
          <span>
            heat = hits in this window · cold {minHits}× → hot {maxHits}×
          </span>
        </div>
        <div className="felt">
          <div className="heat-legend" aria-hidden>
            <i>cold</i>
            <b />
            <i>hot</i>
          </div>
          <div className="board" role="grid" aria-label="Lucky Pick heat map">
            {GRID.map((display, i) => {
              const stat = byDisplay.get(display)!
              const isLast = analysis.lastSquare === display
              const isPick = pickSet.has(display)
              const pickRank = analysis.picks.find((p) => p.square === display)?.rank
              const heat = heatT(stat.hits, minHits, maxHits)
              return (
                <div
                  key={display}
                  role="gridcell"
                  className={[
                    'sq',
                    isInside(display) ? 'inside' : 'outside',
                    isLast ? 'last' : '',
                    isPick ? 'pick' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    {
                      '--heat': String(heat),
                      animationDelay: `${i * 8}ms`,
                    } as CSSProperties
                  }
                >
                  {pickRank != null && <em className="rank">{pickRank}</em>}
                  <strong className="num">{display}</strong>
                  <small className="hits">{stat.hits}</small>
                </div>
              )
            })}
          </div>
        </div>
        <div className="tape" aria-label="Recent prints">
          {analysis.recent.slice(0, 20).map((r) => {
            const n = toDisplay(r.square)
            const stat = byDisplay.get(n)
            const heat = heatT(stat?.hits ?? 0, minHits, maxHits)
            return (
              <span
                key={r.id}
                className={`tick ${isInside(n) ? 'in' : ''} ${pickSet.has(n) ? 'is-pick' : ''}`}
                style={{ '--heat': String(heat) } as CSSProperties}
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
            {analysis.hot.slice(0, 5).map((s) => (
              <span key={s.square} className={`chip hot ${isInside(s.square) ? 'in' : ''}`}>
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
            {analysis.due.slice(0, 5).map((s) => (
              <span key={s.square} className={`chip due ${isInside(s.square) ? 'in' : ''}`}>
                <b>{s.square}</b>
                <i>{s.gap}</i>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="leans-sec">
        <div className="sec-head">
          <h2>Other leans</h2>
          <span>odd/even · high/low · thirds</span>
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
        {gridLeans.length > 0 && (
          <div className="grid-leans">
            {gridLeans.map((b) => (
              <span key={b.key} className={`gchip ${b.delta >= 0 ? 'up' : 'down'}`}>
                <b>{b.label}</b>
                <i>{formatPct(b.share)}</i>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="feed-sec">
        <button type="button" className="feed-btn" onClick={() => setShowFeed((v) => !v)}>
          {showFeed ? 'Hide feed' : 'Round feed'}
          <span>{analysis.recent.length}</span>
        </button>
        <p className="disclaimer">Fan terminal · play on mine.critters.quest · not affiliated</p>
      </section>

      <footer className="site-foot">
        <a href="/watch">Valdara · roster HQ</a>
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
