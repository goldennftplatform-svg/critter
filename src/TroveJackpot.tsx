import { formatQuest, shortTime } from './lib/format'
import { fmtEta, fmtJackpot, fmtRoundsClock, type TroveDesk } from './lib/trove'

export function TroveJackpot({ desk }: { desk: TroveDesk }) {
  const last = desk.last
  const overdue = desk.dueMult >= 1
  const fill = Math.min(desk.dueMult, 1.6) / 1.6
  const paid = desk.hits.slice(0, 8)
  const coming = desk.coming.slice(0, 5)
  const tape = desk.hits.length ? desk.hits.slice(0, 10) : []

  return (
    <section className={`jackpot ${overdue ? 'hot' : ''}`} aria-label="Trove">
      <div className="jp-marquee" aria-hidden>
        <div className="jp-track">
          {tape.concat(tape).map((h, i) => (
            <span key={`${h.id}-${i}`}>
              #{h.square} {h.tier.toUpperCase()} {fmtJackpot(h.sol)}
            </span>
          ))}
        </div>
      </div>

      <div className="jp-hero">
        <p className="jp-kicker">{overdue ? 'DUE' : 'LAST PAID'}</p>
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
          <em>{overdue ? 'overdue' : fmtEta(desk.estRounds)}</em>
        </div>
        <div>
          <b>{(desk.rate * 100).toFixed(1)}%</b>
          <span>hit</span>
          <em>
            {desk.minor} min · {desk.major} maj
          </em>
        </div>
      </div>

      <div className="jp-rails">
        <div className="jp-rail">
          <h3>NEXT</h3>
          <div className="jp-next-hero">
            <b>{overdue ? 'NOW' : fmtEta(desk.estRounds)}</b>
            <span>{overdue ? 'overdue' : fmtRoundsClock(desk.estRounds)}</span>
          </div>
          <div className="jp-typ">
            <div>
              <b>{desk.avgMinor ? fmtJackpot(desk.avgMinor) : '—'}</b>
              <span>typ min</span>
            </div>
            <div>
              <b>{desk.avgMajor ? fmtJackpot(desk.avgMajor) : '—'}</b>
              <span>typ maj</span>
            </div>
            <div>
              <b>{desk.avgPay ? fmtJackpot(desk.avgPay) : '—'}</b>
              <span>typ</span>
            </div>
          </div>
          {coming.length > 0 && (
            <div className="jp-coming" aria-label="Due numbers">
              {coming.map((s) => (
                <span key={s.square} className={last?.square === s.square ? 'on' : ''}>
                  <b>#{s.square}</b>
                  <i>{fmtJackpot(s.lastSol)}</i>
                  <em>{fmtRoundsClock(s.since)}</em>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="jp-rail">
          <h3>PAID</h3>
          <div className="jp-typ">
            <div>
              <b>{desk.paidSol ? fmtJackpot(desk.paidSol) : '—'}</b>
              <span>tot</span>
            </div>
            <div>
              <b>{desk.biggest ? fmtJackpot(desk.biggest.sol) : '—'}</b>
              <span>big{desk.biggest ? ` #${desk.biggest.square}` : ''}</span>
            </div>
            <div>
              <b>{desk.paidOre ? formatQuest(desk.paidOre, 0) : '—'}</b>
              <span>quest</span>
            </div>
          </div>
          {paid.length > 0 && (
            <ol className="jp-paid">
              {paid.map((h) => (
                <li key={h.id}>
                  <strong>#{h.square}</strong>
                  <em className={/major/i.test(h.tier) ? 'major' : ''}>{h.tier}</em>
                  <b>{fmtJackpot(h.sol)}</b>
                  <i>{h.ore > 0 ? `${formatQuest(h.ore, 0)}q` : '—'}</i>
                  <span>{shortTime(h.ts)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
