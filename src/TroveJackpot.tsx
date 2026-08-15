import { formatQuest, shortTime } from './lib/format'
import { fmtJackpot, fmtRoundsClock, type TroveDesk } from './lib/trove'

export function TroveJackpot({ desk }: { desk: TroveDesk }) {
  const last = desk.last
  const overdue = desk.dueMult >= 1
  const fill = Math.min(desk.dueMult, 1.6) / 1.6
  const hot = desk.bySquare.slice(0, 6)

  return (
    <section className={`jackpot ${overdue ? 'hot' : ''}`} aria-label="Trove">
      <div className="jp-marquee" aria-hidden>
        <div className="jp-track">
          {(desk.hits.length ? desk.hits.slice(0, 10) : []).concat(desk.hits.slice(0, 10)).map((h, i) => (
            <span key={`${h.id}-${i}`}>
              #{h.square} {h.tier.toUpperCase()} {fmtJackpot(h.sol)}
            </span>
          ))}
        </div>
      </div>

      <div className="jp-hero">
        <p className="jp-kicker">{overdue ? 'DUE' : 'TROVE'}</p>
        <div className="jp-amt">
          <b>{last ? fmtJackpot(last.sol) : '—'}</b>
          <i>SOL</i>
        </div>
        <div className="jp-last">
          {last ? (
            <>
              <em className={`jp-tier ${/major/i.test(last.tier) ? 'major' : 'minor'}`}>{last.tier}</em>
              <strong>#{last.square}</strong>
              <span>{shortTime(last.ts)}</span>
              {last.ore > 0 && <span>{formatQuest(last.ore, 0)} Q</span>}
            </>
          ) : (
            <span>NO HIT IN CACHE</span>
          )}
        </div>
      </div>

      <div className={`jp-meter ${overdue ? 'over' : ''}`}>
        <i style={{ width: `${Math.min(fill * 100, 100)}%` }} />
      </div>

      <div className="jp-stats">
        <div>
          <b>{desk.since}</b>
          <span>since</span>
          <em>{fmtRoundsClock(desk.since)}</em>
        </div>
        <div>
          <b>{desk.avgGap ? desk.avgGap.toFixed(0) : '—'}</b>
          <span>avg</span>
          <em>{desk.avgGap ? fmtRoundsClock(desk.avgGap) : '—'}</em>
        </div>
        <div className={overdue ? 'due' : ''}>
          <b>{overdue ? 'NOW' : desk.estRounds}</b>
          <span>est</span>
          <em>{overdue ? 'overdue' : fmtRoundsClock(desk.estRounds)}</em>
        </div>
        <div>
          <b>{(desk.rate * 100).toFixed(1)}%</b>
          <span>hit</span>
          <em>
            {desk.minor} min · {desk.major} maj
          </em>
        </div>
      </div>

      {hot.length > 0 && (
        <div className="jp-nums" aria-label="Trove numbers">
          {hot.map((s) => (
            <span key={s.square} className={last?.square === s.square ? 'on' : ''}>
              <b>{s.square}</b>
              <i>×{s.n}</i>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
