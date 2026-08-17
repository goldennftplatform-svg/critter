import { useEffect, useState } from 'react'
import './Watch.css'
import { fmtSolTiny } from './lib/bps'
import { RH_EST_PCT, rhCommit, rhPhase } from './lib/rh'
import { critterPng, factionHue, fmtBoard, shortMaster } from './lib/faction'
import {
  WALLET_EVENT,
  connectWallet,
  disconnectWallet,
  getConnectedWallet,
} from './lib/wallet'
import { MineDesk } from './MineDesk'
import type { WatchMaster, WatchPayload, WatchWallet } from './lib/watchTypes'

export const TRACK_KEY = 'critter-watch-wallets'
const MINE_TRACK_KEY = 'critter-mine-track'

function loadMineTrack() {
  try {
    return localStorage.getItem(MINE_TRACK_KEY) === '1'
  } catch {
    return false
  }
}

function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim())
}

export function loadTracked(): string[] {
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
          {m.bpsKnown === false ? 'BPS —' : m.bps ? `${m.bps.toFixed(3)} BPS` : 'no BPS'} ·{' '}
          {fmtBoard(m.tokens)} board
          {m.editions ? ` · ${m.editions} ed` : ''}
        </span>
        {gear.length > 0 && <span className="rgear">{gear.join(' · ')}</span>}
      </div>
    </div>
  )
}

export function WalletCard({
  w,
  onRemove,
}: {
  w: WatchWallet
  onRemove?: (wallet: string) => void
}) {
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
        {w.boardQuest > 0 && rhPhase() !== 'done' && (
          <div className="rh-stat">
            <b>{fmtBoard(rhCommit(w.boardQuest, RH_EST_PCT))}</b>
            <span>RH est 25%</span>
          </div>
        )}
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

export function WalletDesk({ teaser = false }: { teaser?: boolean }) {
  const [data, setData] = useState<WatchPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [tracked, setTracked] = useState<string[]>(() => loadTracked())
  const [connected, setConnected] = useState(() => getConnectedWallet())
  const [trackMine, setTrackMine] = useState(() => loadMineTrack())
  const [draft, setDraft] = useState('')
  const [addNote, setAddNote] = useState<string | null>(null)

  function persistMineTrack(on: boolean) {
    setTrackMine(on)
    try {
      localStorage.setItem(MINE_TRACK_KEY, on ? '1' : '0')
    } catch {
      /* private mode */
    }
  }

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
      setAddNote(null)
    } catch (err) {
      setAddNote(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
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
    setAddNote('Pinned.')
    if (teaser) persistMineTrack(true)
  }

  async function addConnected() {
    setAddNote(null)
    try {
      const wallet = await connectWallet()
      if (!tracked.includes(wallet)) addWallet(wallet)
      if (teaser) persistMineTrack(true)
      await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'login', wallet }),
      })
    } catch (err) {
      setAddNote(err instanceof Error ? err.message : String(err))
    }
  }

  async function dropConnected() {
    const addr = connected || getConnectedWallet()
    setAddNote(null)
    try {
      await disconnectWallet()
      if (addr) persist(tracked.filter((x) => x !== addr))
      await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'logout' }),
      })
    } catch (err) {
      setAddNote(err instanceof Error ? err.message : String(err))
    }
  }

  function dropWallet(addr: string) {
    if (addr === (connected || getConnectedWallet())) {
      dropConnected()
      return
    }
    persist(tracked.filter((x) => x !== addr))
  }

  useEffect(() => {
    function onWallet(e: Event) {
      const addr = (e as CustomEvent<string | null>).detail ?? getConnectedWallet()
      setConnected(addr)
    }
    window.addEventListener(WALLET_EVENT, onWallet)
    return () => window.removeEventListener(WALLET_EVENT, onWallet)
  }, [])

  useEffect(() => {
    load(tracked)
    const t = setInterval(() => load(tracked).catch(() => {}), 60_000)
    return () => clearInterval(t)
  }, [tracked])

  const mine = data?.wallets.filter((w) => isCustomId(w.id)) ?? []
  const whales = data?.wallets.filter((w) => !isCustomId(w.id)) ?? []

  return (
    <section className={`wallet-desk ${teaser ? 'teaser' : ''}`}>
      <div className="sec-head">
        <h2>Your desk</h2>
        <span>{teaser ? 'Opt in to track QUEST in/out' : 'Paste an address or connect Phantom'}</span>
      </div>
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
            placeholder="Paste Solana address or connect Phantom"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn" disabled={busy}>
          Pin
        </button>
        {connected ? (
          <button type="button" className="btn ghost" onClick={() => dropConnected()} disabled={busy}>
            Disconnect
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={() => addConnected()} disabled={busy}>
            Connect wallet
          </button>
        )}
        {addNote && <p className="watch-add-note">{addNote}</p>}
        {teaser && (
          <label className="mine-opt">
            <input
              type="checkbox"
              checked={trackMine}
              onChange={(e) => persistMineTrack(e.target.checked)}
            />
            Track QUEST in/out
          </label>
        )}
      </form>

      {teaser && trackMine && (connected || tracked[0]) && (
        <MineDesk wallets={connected ? [connected, ...tracked.filter((w) => w !== connected)].slice(0, 2) : tracked.slice(0, 2)} />
      )}

      {mine.length > 0 && (
        <div className="watch-stack">
          {mine.map((w) => (
            <WalletCard
              key={w.id}
              w={w}
              onRemove={(addr) => dropWallet(addr)}
            />
          ))}
        </div>
      )}

      {!teaser && (
        <div className="watch-stack">
          {whales.map((w) => (
            <WalletCard key={w.id} w={w} />
          ))}
        </div>
      )}

      {teaser && mine.length === 0 && (
        <p className="watch-add-note">
          Pin your wallet and opt in to track QUEST in/out on Lucky Pick.
        </p>
      )}
    </section>
  )
}
