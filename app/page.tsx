'use client';

import { GAME_CATALOG } from '@playroom/game-core';
import { GuestSession } from './guest-session';
import { LanguageToggle, useLanguage } from './language';
import { CreateRoomButton, JoinRoomForm } from './lobby-actions';

const copy = {
  en: {
    navNote: 'Anonymous multiplayer', eyebrow: 'No accounts · one room code', titleLead: 'Pick a game.', titleAccent: 'Start a room.',
    hero: 'One short code, two players, zero sign-up forms. Choose a game, open a room, and send the code to a friend.',
    browse: 'Browse games', joinEyebrow: 'Already have a code?', joinTitle: 'Jump straight in.', radarOpen: 'OPEN ROOMS',
    radarNoLogin: 'NO LOGIN NEEDED', radarReady: 'READY?', radarLabel: 'ROOM RADAR / LIVE', shelfEyebrow: 'Pick a tiny universe',
    shelfTitle: 'Choose your game.', shelfNote: 'Ready in under two minutes', players: 'players', minutes: 'min', turnBased: 'turn-based',
    realtime: 'real-time', ready: 'Ready now', soon: 'Coming soon', ticDescription: 'Three in a row. Quick to learn, surprisingly hard to leave unfinished.',
    stairsDescription: 'Fall the shaft, dodge traps, and keep your life gauge off zero. Solo or Shared well for 2–4 kids.', connectTitle: 'Connect Four',
    connectDescription: 'Four pieces, one clean line, and just enough room for a trap.', workshop: 'In the workshop', wishlist: 'Next on the shelf',
    howEyebrow: 'The tiny ritual', howTitle: 'Three steps. No ceremony.', stepOneTitle: 'Pick a game',
    stepOneBody: 'See the player count, play time, and supported mode before you start.', stepTwoTitle: 'Create or join',
    stepTwoBody: 'Share one short room code. No email, password, or permanent profile.', stepThreeTitle: 'Ready, set, play',
    stepThreeBody: 'The server keeps every turn authoritative and restores the latest board.', footerLead: 'Designed for quick games and low friction',
    footerPrivacy: 'Anonymous by default · temporary guest sessions',
  },
  'zh-Hant': {
    navNote: '匿名多人遊戲', eyebrow: '無需帳戶 · 一個房號就開局', titleLead: '揀隻遊戲。', titleAccent: '即刻開房。',
    hero: '一個短房號，兩位玩家，零張註冊表格。揀好遊戲、開個房，再把房號傳給朋友。',
    browse: '睇下玩咩', joinEyebrow: '已經有房號？', joinTitle: '直接入房。', radarOpen: '開放房間', radarNoLogin: '無需登入',
    radarReady: '準備好？', radarLabel: '房間雷達 / LIVE', shelfEyebrow: '揀一個小宇宙', shelfTitle: '揀隻遊戲先。',
    shelfNote: '兩分鐘內開局', players: '位玩家', minutes: '分鐘', turnBased: '回合制', realtime: '即時模式', ready: '可以開局', soon: '即將推出',
    ticDescription: '三格連線。規則簡單，但未必容易贏，也很難中途停手。', stairsDescription: '墜入井中、避開陷阱，別讓生命歸零。單人 Solo 或 2–4 人 Shared 共用井現已可玩。',
    connectTitle: '四子棋', connectDescription: '四粒棋連成一線，棋盤不大，剛好放得下一個陷阱。', workshop: '製作中', wishlist: '下一款遊戲',
    howEyebrow: '簡單開局流程', howTitle: '三步，唔使諗太多。', stepOneTitle: '揀遊戲', stepOneBody: '開局前先看清楚玩家人數、遊戲時間和支援模式。',
    stepTwoTitle: '開房或入房', stepTwoBody: '分享一個短房號，毋須電郵、密碼或永久帳戶。', stepThreeTitle: '準備，開局',
    stepThreeBody: '伺服器會核實每一步，並在重新連線後還原最新棋局。', footerLead: '為快速遊戲和低阻力體驗而設',
    footerPrivacy: '預設匿名 · 使用臨時訪客工作階段',
  },
} as const;

function cardMeta(slug: string, language: 'en' | 'zh-Hant', text: (typeof copy)['en'] | (typeof copy)['zh-Hant']) {
  if (slug === 'connect-four') {
    return {
      className: 'game-card game-card-connect',
      title: language === 'en' ? 'Connect Four' : '四子棋',
      description: text.connectDescription,
      icon: '⬤⬤',
      mode: text.turnBased,
    };
  }
  if (slug === 'downstairs') {
    return {
      className: 'game-card game-card-stairs',
      title: '小朋友落樓梯',
      description: text.stairsDescription,
      icon: '⇧',
      mode: text.realtime,
    };
  }
  return {
    className: 'game-card game-card-featured',
    title: language === 'en' ? 'Tic-tac-toe' : '井字過三關',
    description: text.ticDescription,
    icon: '✕◯',
    mode: text.turnBased,
  };
}

export default function HomePage() {
  const { language } = useLanguage();
  const text = copy[language];

  return (
    <main className="page-shell">
      <nav className="topbar" aria-label={language === 'en' ? 'Primary navigation' : '主要導覽'}>
        <a className="brand" href="/" aria-label="PLAYROOM home"><span className="brand-mark" aria-hidden="true" /><span className="brand-name">PLAYROOM</span><span className="brand-local">玩房</span></a>
        <div className="top-actions"><span className="nav-note"><i className="pulse" aria-hidden="true" />{text.navNote}</span><LanguageToggle /></div>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy-block">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 id="hero-title">{text.titleLead}<br /><em>{text.titleAccent}</em></h1>
          <p className="hero-copy">{text.hero}</p>
          <div className="hero-actions"><a className="button button-primary" href="#games">＋ {text.browse}</a></div>
          <div className="hero-join" id="join"><div><p className="join-kicker">{text.joinEyebrow}</p><strong>{text.joinTitle}</strong></div><JoinRoomForm /></div>
        </div>

        <div className="radar-wrap" aria-label={language === 'en' ? 'Room radar illustration' : '房間雷達插圖'}>
          <div className="radar" aria-hidden="true">
            <div className="radar-cross" />
            <div className="orbit"><span className="token token-a">XO</span><span className="token token-b">42</span><span className="token token-c">↗</span><span className="token token-d">骰</span></div>
            <span className="radar-label radar-label-one">{text.radarOpen}</span><span className="radar-label radar-label-two">{text.radarNoLogin}</span>
            <div className="radar-core"><div><strong>{text.radarReady}</strong><span>{text.radarLabel}</span></div></div>
          </div>
        </div>
      </section>

      <section className="catalogue" id="games" aria-labelledby="games-title">
        <div className="section-heading"><div><p className="eyebrow">{text.shelfEyebrow}</p><h2 id="games-title">{text.shelfTitle}</h2></div><span className="shelf-count">{text.shelfNote}</span></div>
        <div className="game-grid">
          {GAME_CATALOG.filter((game) => game.available).map((game) => {
            const meta = cardMeta(game.slug, language, text);
            const playerLabel = game.players.min === game.players.max
              ? `${game.players.min}`
              : `${game.players.min}–${game.players.max}`;
            return (
              <article className={meta.className} key={game.slug}>
                <div className="card-topline"><span className="game-prefix">{game.roomPrefix} · {playerLabel} {text.players} · {game.estimatedMinutes} {text.minutes}</span><span className="status-dot">{text.ready}</span></div>
                <div className="game-icon" aria-hidden="true">{meta.icon}</div>
                <div className="card-content"><h3>{meta.title}</h3><p>{meta.description}</p></div>
                <div className="game-bottom"><span>{meta.mode}</span><span>{text.ready}</span></div><CreateRoomButton gameSlug={game.slug} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <div><p className="eyebrow">{text.howEyebrow}</p><h2 id="how-title">{text.howTitle}</h2></div>
        <div className="step-list">
          <div className="step"><b>01</b><h3>{text.stepOneTitle}</h3><p>{text.stepOneBody}</p></div>
          <div className="step"><b>02</b><h3>{text.stepTwoTitle}</h3><p>{text.stepTwoBody}</p></div>
          <div className="step"><b>03</b><h3>{text.stepThreeTitle}</h3><p>{text.stepThreeBody}</p></div>
        </div>
      </section>

      <footer className="footer"><span>PLAYROOM / 玩房 · {text.footerLead}</span><span>{text.footerPrivacy}</span><GuestSession /></footer>
    </main>
  );
}
