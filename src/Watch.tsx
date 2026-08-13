import { useEffect, useState } from 'react'
import './Watch.css'
import { BrandBar } from './Brand'
import { fmtSolTiny } from './lib/bps'
import { critterPng, factionHue, fmtBoard, shortMaster } from './lib/faction'
import { connectWallet } from './lib/wallet'
import type { WatchMaster, WatchPayload, WatchWallet } from './lib/watchTypes'

const TRACK_KEY = 'critter-watch-wallets'

function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim())
}

function loadTracked(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TRACK_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function isCustomId(id: string) {
  return id.startsWith('mine-') || id.startsWith('add-')
}

function isWorn(value: string | null | undefined) {
  if (!value) return false
  return !/^(none|null|0|-)$/i.test(value.trim())
}

function MasterCard({ m }: { m: WatchMaster }) {
  const gear = [m.weapon, m.shield, m.hat, m.amulet, m.boots].filter(isWorn)
  return (
    <div className={`rmini ${factionHue(m.faction)}`}>
      <img
        className="rpic"
        src={critterPng(m.name)}
        alt={shortMaster(m.name)}
        width={88}
        height={88}
      />
      <div className="rbody">
        <b>{shortMaster(m.name)}</b>
        <span className="rsub">
          {[m.species, m.faction, m.level ? `L${m.level}` : 'L0'].filter(Boolean).join(' · ')}
        </span>
        <div className="rstats">
          <span className="atk">ATK {m.atk}</span>
          <span>DEF {m.def}</span>
          <span>HP {m.hp}</span>
        </div>
        <span className="rsub">
          {m.bps ? `${m.bps.toFixed(3)} BPS` : 'no BPS'} · {fmtBoard(m.tokens)} board
          {m.editions ? ` · ${m.editions} ed` : ''}
        </span>
        {gear.length > 0 && <span className="rgear">{gear.join(' · ')}</span>}
      </div>
    </div>
  )
}

function WalletCard({ w, onRemove }: { w: WatchWallet; onRemove?: (wallet: string) => void }) {
  const terronBits = Object.entries(w.terron || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([n, c]) => `#${n}×${c}`)
  const town = w.towns?.[0]

  return (
    <article className={`wcard ${w.id}`}>
      <div className="wcard-head">
        {w.masters[0] && (
          <img
            className="whero"
            src={critterPng(w.masters[0].name)}
            alt=""
            width={88}
            height={88}
          />
        )}
        <div>
          <h2>{w.label}</h2>
          <span className="tag">{w.masterCount} masters</span>
          {onRemove && (
            <button type="button" className="wdrop" onClick={() => onRemove(w.wallet)}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="wcard-tagline">{w.tagline}</p>
      <div className="wcard-stats">
            <div>
          <b className={w.sol < 0.45 ? 'warn' : ''}>{w.sol.toFixed(2)}</b>
          <span>SOL</span>
        </div>
        <div>
          <b>{fmtBoard(w.boardQuest)}</b>
          <span>Board</span>
        </div>
        <div>
          <b>{w.bpsSum > 0 ? w.bpsSum.toFixed(3) : '—'}</b>
          <span>BPS</span>
        </div>
        <div>
          <b>{w.bpsYield ? fmtSolTiny(w.bpsYield.perDay) : '—'}</b>
          <span>SOL/day est</span>
        </div>
      </div>

      {w.boxes && (
        <div className={`box-desk ${w.boxes.verdict}`}>
          <p className="steps-label">Blind Box desk</p>
          <strong>{w.boxes.headline}</strong>
          <p>{w.boxes.inventory || w.boxes.chain}</p>
          <p className="box-move">{w.boxes.move}</p>
          <p className="box-why">{w.boxes.detail}</p>
        </div>
      )}

      {w.rares.length > 0 && (
        <div className="rare-desk">
          <p className="steps-label">Super rares</p>
          {w.rares.map((r) => (
            <div className={`rare ${r.tier}`} key={`${r.on}-${r.slot}-${r.name}`}>
              <b>{r.name}</b>
              <i>
                {r.tier} · {r.slot}
                {r.stats ? ` · ${r.stats}` : ''} · {shortMaster(r.on)}
              </i>
            </div>
          ))}
        </div>
      )}

      {town && (
        <div className="town-chip">
          <b>{town.name}</b>
          <span>
            {town.zone} · L{town.level} · Bank {town.bank || '—'} · Walls {town.walls || '—'}
          </span>
        </div>
      )}

      {w.terronTotal > 0 && (
        <p className="terron-line">
          Terron {w.terronTotal} shards {terronBits.join(' ')}
          {w.terronHotMissing.length
            ? ` · missing hot #${w.terronHotMissing.join(' & #')}`
            : ' · 0/8 on-hand'}
        </p>
      )}

      <p className="steps-label">Next steps</p>
      <div className="steps">
        {w.nextSteps.slice(0, 6).map((s) => (
          <div className={`step ${s.priority}`} key={s.title}>
            <strong>{s.title}</strong>
            <p>{s.detail}</p>
          </div>
        ))}
      </div>

      {w.masters.length > 0 && (
        <div className="roster-wrap">
          <p className="steps-label">Roster · {w.masters.length} critters</p>
          <div className="roster" aria-label="Roster">
            {w.masters.map((m) => (
              <MasterCard key={m.name} m={m} />
            ))}
          </div>
        </div>
      )}
      <a className="map-btn" href={w.mapUrl} target="_blank" rel="noreferrer">
        Live map · spectate
      </a>
      <p className="wcard-foot">{w.shortWallet}</p>
    </article>
  )
}

export default function Watch() {
  const [data, setData] = useState<WatchPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tracked, setTracked] = useState<string[]>(() => loadTracked())
  const [draft, setDraft] = useState('')
  const [addNote, setAddNote] = useState<string | null>(null)

  function persist(next: string[]) {
    const uniq = [...new Set(next.map((w) => w.trim()).filter(isSolanaAddress))].slice(0, 4)
    setTracked(uniq)
    localStorage.setItem(TRACK_KEY, JSON.stringify(uniq))
  }

  async function load(list = tracked) {
    setBusy(true)
    try {
      const q = list.length ? `?add=${encodeURIComponent(list.join(','))}` : ''
      const res = await fetch(`/api/watch${q}`, { cache: 'no-store' })
      if (res.status === 402) return
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

  function addWallet(addr: string) {
    const wallet = addr.trim()
    if (!isSolanaAddress(wallet)) {
      setAddNote('That is not a Solana address.')
      return
    }
    if (tracked.includes(wallet)) {
      setAddNote('Already on the desk.')
      return
    }
    if (tracked.length >= 4) {
      setAddNote('Max 4 extra wallets on this desk.')
      return
    }
    persist([wallet, ...tracked])
    setDraft('')
    setAddNote('Pinned. Scanning…')
  }

  async function addConnected() {
    setAddNote(null)
    try {
      const wallet = await connectWallet()
      addWallet(wallet)
    } catch (err) {
      setAddNote(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    fetch('/api/gate', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((json) => {
        const w = json?.data?.wallet
        if (typeof w === 'string' && isSolanaAddress(w)) {
          persist([w, ...loadTracked()])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(tracked)
    const t = setInterval(() => load(tracked).catch(() => {}), 60_000)
    return () => clearInterval(t)
  }, [tracked])

  if (loading) {
    return (
      <div className="boot">
        <div className="spinner" />
        <span>Scouting Valdara…</span>
      </div>
    )
  }

  const q = data?.bpsQuote

  return (
    <div className="watch">
      <header className="watch-top">
        <div>
          <BrandBar world="valdara" />
          <h1>VALDARA HQ</h1>
          <p className="watch-sub">
            Paste or connect a wallet to pin your own roster. MF5 / USSA stay on the desk as
            public whales. Live map is free spectate — no keys.
          </p>
        </div>
        <div className="watch-actions">
          <a
            className="btn sync"
            href={data?.spectateUrl || 'https://game.critters.quest/?spectate=1'}
            target="_blank"
            rel="noreferrer"
          >
            Map
          </a>
          <button type="button" className="btn ghost" onClick={() => load()} disabled={busy}>
            {busy ? '…' : 'Rescan'}
          </button>
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

      {error && <p className="watch-err">{error}</p>}
      {data?.note && <p className="watch-note">{data.note}</p>}

      <form
        className="watch-add"
        onSubmit={(e) => {
          e.preventDefault()
          addWallet(draft)
        }}
      >
        <label>
          Add a wallet
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Solana address or connect Phantom"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn" disabled={busy}>
          Pin
        </button>
        <button type="button" className="btn ghost" onClick={() => addConnected()} disabled={busy}>
          Connect wallet
        </button>
        {addNote && <p className="watch-add-note">{addNote}</p>}
      </form>

      <div className="watch-stack">
        {data?.wallets.map((w) => (
          <WalletCard
            key={w.id}
            w={w}
            onRemove={isCustomId(w.id) ? (addr) => persist(tracked.filter((x) => x !== addr)) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
