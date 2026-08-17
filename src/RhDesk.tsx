import { useEffect, useState } from 'react'
import './Watch.css'
import { fmtBoard, shortMaster } from './lib/faction'
import { fmtRhClock, RH_EST_PCT, RH_PCTS, rhCommit, rhPhase, rhRemain } from './lib/rh'
import type { WatchWallet } from './lib/watchTypes'

export function RhDesk({ wallets }: { wallets: WatchWallet[] }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const phase = rhPhase(now)
  if (phase === 'done') return null
  const bags = wallets.filter((w) => w.masterCount > 0)
  if (bags.length === 0) return null

  const board = bags.reduce((s, w) => s + w.boardQuest, 0)
  const missing = bags.reduce((s, w) => s + w.masters.filter((m) => m.bpsKnown === false).length, 0)
  const chips = bags
    .flatMap((w) => w.masters.map((m) => ({ ...m, bag: w.label })))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8)

  return (
    <section className={`rh ${phase}`} aria-label="Robinhood">
      <div className="rh-hero">
        <p className="rh-kicker">{phase === 'open' ? 'OPT IN' : 'RH'}</p>
        <div className="rh-clock">
          <b>{phase === 'open' ? 'NOW' : fmtRhClock(rhRemain(now))}</b>
          <i>AUG 20</i>
        </div>
      </div>
      <div className="rh-stats">
        <div>
          <b>{fmtBoard(board)}</b>
          <span>board</span>
        </div>
        {RH_PCTS.map((pct) => (
          <div key={pct} className={pct === RH_EST_PCT ? 'on' : ''}>
            <b>{fmtBoard(rhCommit(board, pct))}</b>
            <span>est {Math.round(pct * 100)}%</span>
          </div>
        ))}
      </div>
      {chips.length > 0 && (
        <div className="rh-nums" aria-label="Bound QUEST">
          {chips.map((m) => (
            <span key={m.name}>
              <b>{shortMaster(m.name)}</b>
              <i>{fmtBoard(m.tokens)}</i>
            </span>
          ))}
        </div>
      )}
      <p className="rh-foot">
        FIXED % · ALL OR NOTHING · TOP UP ≠ IN
        {missing ? ` · ${missing} BPS blank after migrate` : ''}
      </p>
    </section>
  )
}
