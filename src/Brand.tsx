export function BrandBar({ world }: { world: 'mine' | 'valdara' }) {
  return (
    <div className="brand-bar">
      <div className="brand-mark">
        <img className="mascot" src="/critter-mascot.png" alt="" width={50} height={50} />
        <div>
          <p className="eyebrow">Unofficial fan HQ · cartoons welcome</p>
          <strong>CRITTERS QUEST</strong>
        </div>
      </div>
      <nav className="world-nav" aria-label="Worlds">
        <a className={world === 'mine' ? 'on' : ''} href="/">
          Lucky Pick
        </a>
        <a className={world === 'valdara' ? 'on' : ''} href="/watch">
          Valdara
        </a>
        <a href="https://mine.critters.quest" target="_blank" rel="noreferrer">
          Mine ↗
        </a>
        <a href="https://game.critters.quest/?spectate=1" target="_blank" rel="noreferrer">
          Spectate ↗
        </a>
      </nav>
    </div>
  )
}
