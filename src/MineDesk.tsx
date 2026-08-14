import { useEffect, useState } from 'react'
import { formatQuest, formatSol, shortTime, shortWallet, toDisplay } from './lib/format'
import type { MineTrack } from './lib/mineTrack'

function netClass(n: number) {
  if (n > 0) return 'up'
  if (n < 0) return 'down'
  return ''
}

export function MineDesk({ wallets }: { wallets: string[] }) {
  const [tracks, setTracks] = useState<MineTrack[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    const list = wallets.filter(Boolean)
    if (!list.length) {
      setTracks([])
      return
    }
    let alive = true
    async function load() {
      setBusy(true)
      try {
        const q = encodeURIComponent(list.join(','))
        const res = await fetch(`/api/mine?add=${q}`, { cache: 'no-store' })
        const json = await res.json()
        if (!alive) return
        if (!res.ok || !json.success) throw new Error(json.error || `Mine ${res.status}`)
        setTracks(json.data.tracks || [])
        setNote(null)
      } catch (err) {
        if (alive) setNote(err instanceof Error ? err.message : String(err))
      } finally {
        if (alive) setBusy(false)
      }
    }
    load()
    const t = setInterval(() => load().catch(() => {}), 45_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [wallets.join(',')])

  if (!wallets.length) return null

  return (
    <div className="mine-desk">
      {tracks.map((t) => (
        <article className="mine-card" key={t.wallet}>
          <div className="sec-head tight">
            <h2>Your mine</h2>
            <span>
              {shortWallet(t.wallet)} · last {t.sample} rounds
              {busy ? ' · …' : ''}
            </span>
          </div>
          <div className="bps-grid mine-grid">
            <div>
              <b>{formatSol(t.solIn, 3)}</b>
              <span>SOL in</span>
            </div>
            <div>
              <b>{formatSol(t.solOut, 3)}</b>
              <span>SOL out</span>
            </div>
            <div className="bps-hot">
              <b>{formatQuest(t.questIn, 1)}</b>
              <span>QUEST in</span>
            </div>
            <div>
              <b className={netClass(t.netSol)}>{formatSol(t.netSol, 3)}</b>
              <span>SOL net</span>
            </div>
            <div>
              <b>{t.mined}</b>
              <span>mined</span>
            </div>
            <div>
              <b>{t.rounds}</b>
              <span>hits</span>
            </div>
          </div>
          {t.recent.length > 0 ? (
            <div className="mine-plays" aria-label="Recent mine plays">
              {t.recent.map((p) => (
                <div className={`mine-play ${p.solIn > 0 ? 'mined' : ''}`} key={p.id}>
                  <strong>#{toDisplay(p.square)}</strong>
                  <i>#{p.id}</i>
                  <span>in {formatSol(p.solIn, 3)}</span>
                  <span>out {formatSol(p.solOut, 3)}</span>
                  <span className="q">+{formatQuest(p.questIn, 1)} Q</span>
                  <em>{shortTime(p.ts)}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="watch-add-note">No hits in this window. Mine a square on Lucky Pick.</p>
          )}
        </article>
      ))}
      {note && <p className="watch-add-note">{note}</p>}
    </div>
  )
}
