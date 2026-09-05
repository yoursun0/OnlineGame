import { GAME_CATALOG } from '@playroom/game-core';
import { GuestSession } from './guest-session';

export default function HomePage() {
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="/">PLAYROOM<span>／玩房</span></a>
        <span className="nav-note">no accounts · just play</span>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">THE QUICK-PLAY LOBBY</p>
        <h1 id="hero-title">Pick a game.<br /><em>Make a room.</em></h1>
        <p className="hero-copy">Short games for people who are already together — or about to be.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#games">Browse games <span>↓</span></a>
          <a className="button button-quiet" href="#join">Join with a code <span>↗</span></a>
        </div>
      </section>

      <section className="catalogue" id="games" aria-labelledby="games-title">
        <div className="section-heading">
          <div><p className="eyebrow">01 / GAME SHELF</p><h2 id="games-title">Choose your arena</h2></div>
          <span className="shelf-count">{GAME_CATALOG.length.toString().padStart(2, '0')} live · more soon</span>
        </div>
        <div className="game-grid">
          {GAME_CATALOG.map((game) => (
            <article className="game-card game-card-featured" key={game.slug}>
              <div className="card-topline"><span className="game-prefix">{game.roomPrefix} / 001</span><span className="status-dot">READY</span></div>
              <div className="card-art" aria-hidden="true"><span>×</span><span>○</span><span>×</span><span>○</span><span>×</span><span>○</span><span>×</span><span>○</span><span>×</span></div>
              <div className="card-content"><h3>{game.title}</h3><p>{game.shortDescription}</p><div className="card-meta"><span>{game.players.min}–{game.players.max} players</span><span>~{game.estimatedMinutes} min</span><span>real-time / turn-based</span></div></div>
              <a className="card-cta" href="#create-room">Create a room <span>→</span></a>
            </article>
          ))}
          <article className="game-card game-card-soon"><div className="card-topline"><span className="game-prefix">LAD / 002</span><span className="status-muted">SOON</span></div><div className="soon-mark">✳</div><div className="card-content"><h3>小朋友落樓梯</h3><p>A tiny stairway, a little chaos, a lot of luck.</p></div><div className="card-footer-note">IN THE WORKSHOP</div></article>
          <article className="game-card game-card-soon"><div className="card-topline"><span className="game-prefix">CON / 003</span><span className="status-muted">SOON</span></div><div className="soon-mark">＋</div><div className="card-content"><h3>Another quick game</h3><p>The shelf has room for one more.</p></div><div className="card-footer-note">YOUR NEXT FAVOURITE</div></article>
        </div>
      </section>

      <section className="join-strip" id="join" aria-labelledby="join-title"><div><p className="eyebrow">ALREADY HAVE A ROOM CODE?</p><h2 id="join-title">Jump straight in.</h2></div><form className="join-form"><label className="sr-only" htmlFor="room-code">Room code</label><input id="room-code" name="room-code" placeholder="TIK-7Q4" maxLength={7} /><button className="button button-dark" type="button">Join room <span>→</span></button></form></section>

      <footer className="footer"><span>PLAYROOM / 玩房</span><span>Anonymous by design · temporary by default</span><GuestSession /></footer>
    </main>
  );
}
