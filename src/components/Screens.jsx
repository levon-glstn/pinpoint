import {
  MAX_SCORE_PER_ROUND,
  flagEmoji,
  formatKm,
  ratingFor,
  scoreColor,
  verdictFor,
} from '../lib/geo.js'
import { useCountUp } from '../lib/useCountUp.js'
import { useEffect, useMemo, useState } from 'react'
import { LEADERBOARD_SIZE, fetchTopScores, sendMagicLink, signOut, subscribeToScores } from '../lib/supabase.js'

// Decorative emoji confetti ('pop', launched upwards) or rain ('rain', falling).
// Rendered outside transformed/blurred parents so `fixed` means the viewport.
export function EmojiBurst({ emojis, count, mode }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        e: emojis[Math.floor(Math.random() * emojis.length)],
        x: Math.random() * 100, // rain: left position in vw
        drift: (Math.random() - 0.5) * 90, // pop: sideways travel in vw
        rise: 35 + Math.random() * 45, // pop: height in vh
        size: 1.3 + Math.random() * 1.7,
        delay: Math.random() * (mode === 'rain' ? 1.4 : 0.35),
        dur: mode === 'rain' ? 2.2 + Math.random() * 2 : 1.4 + Math.random() * 1.2,
        rot: (Math.random() - 0.5) * 720,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return (
    <div className={`burst burst-${mode}`} aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            '--x': `${it.x}vw`,
            '--drift': `${it.drift}vw`,
            '--rise': `${it.rise}vh`,
            '--size': `${it.size}rem`,
            '--rot': `${it.rot}deg`,
            animationDelay: `${it.delay}s`,
            animationDuration: `${it.dur}s`,
          }}
        >
          {it.e}
        </span>
      ))}
    </div>
  )
}

export function Intro({ best, onPlay, loading, onLeaderboard, onHelp, onAccount, user, rounds }) {
  return (
    <>
      {onAccount && (
        <button className="btn btn-ghost account-chip" onClick={onAccount}>
          {user && !user.is_anonymous ? user.email : 'Sign in'}
        </button>
      )}
      <header className="intro-title">
        <p className="eyebrow">A geography game</p>
        <h1>Pinpoint</h1>
        <p className="tagline">Spin the globe. Drop a pin. Find every capital.</p>
      </header>
      <div className="dock dock-intro">
        <button className="btn btn-primary btn-lg" onClick={onPlay} disabled={loading} autoFocus>
          {loading ? 'Loading…' : 'Start playing'}
        </button>
        <div className="dock-row">
          <button className="btn btn-ghost" onClick={onHelp}>
            How to play
          </button>
          {onLeaderboard && (
            <button className="btn btn-ghost" onClick={onLeaderboard}>
              Leaderboard
            </button>
          )}
        </div>
        <p className="muted">
          {rounds} rounds {best > 0 && <>· Personal best <b>{best.toLocaleString()}</b></>}
        </p>
      </div>
    </>
  )
}

export function TopBar({ round, rounds, results, total }) {
  const score = useCountUp(total)
  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-dot" /> Pinpoint
      </div>
      <div className="progress" aria-label={`Round ${round + 1} of ${rounds}`}>
        {Array.from({ length: rounds }, (_, i) => (
          <span
            key={i}
            className={`seg ${i === round ? 'seg-current' : ''}`}
            style={results[i] ? { background: scoreColor(results[i].points) } : undefined}
          />
        ))}
      </div>
      <div className="score">
        <span className="muted">Score</span>
        <b>{score.toLocaleString()}</b>
      </div>
    </div>
  )
}

export function PromptCard({ country, round, hasGuess }) {
  return (
    <div className="prompt glass" key={country.code}>
      <span className="muted">
        Round {round + 1} · Find the capital of
      </span>
      <div className="prompt-country">
        <span className="flag">{flagEmoji(country.cca2)}</span>
        <h2>{country.name}</h2>
      </div>
      <span className="hint">{hasGuess ? 'Click again to move your pin' : 'Click the globe to drop a pin'}</span>
    </div>
  )
}

export function GuessDock({ hasGuess, onConfirm }) {
  return (
    <div className="dock">
      <button className="btn btn-primary btn-lg" disabled={!hasGuess} onClick={onConfirm}>
        Lock in guess <kbd>↵</kbd>
      </button>
    </div>
  )
}

export function RevealCard({ result, isLast, onNext }) {
  const { country, km, points } = result
  const verdict = useMemo(() => verdictFor(km), [km])
  const shown = useCountUp(points, 700)
  return (
    <>
      {verdict.burst && <EmojiBurst {...verdict.burst} />}
      <div className="dock">
        <div className={`reveal glass reveal-${verdict.tier}`}>
          <div className="reveal-verdict">
            <span className="reveal-emoji">{verdict.emoji}</span>
            <div className="reveal-text">
              <span className="reveal-label">{verdict.label}</span>
              {verdict.sub && <small className="reveal-sub">{verdict.sub}</small>}
            </div>
          </div>
          <div className="reveal-grid">
            <div>
              <span className="muted">Capital of {country.name}</span>
              <b className="reveal-capital">{country.capital}</b>
            </div>
            <div>
              <span className="muted">You were</span>
              <b>{formatKm(km)} away</b>
            </div>
            <div>
              <span className="muted">Points</span>
              <b className="reveal-points" style={{ color: scoreColor(points) }}>
                +{shown.toLocaleString()}
              </b>
            </div>
          </div>
          <button className="btn btn-primary" onClick={onNext} autoFocus>
            {isLast ? 'See results' : 'Next country'} <kbd>↵</kbd>
          </button>
        </div>
      </div>
    </>
  )
}

export function Results({ results, total, best, isNewBest, onRestart, onHome, onLeaderboard, onSave, onAccount, user }) {
  const score = useCountUp(total, 1400)
  const rating = ratingFor(total)
  return (
    <>
      {rating.burst && <EmojiBurst {...rating.burst} />}
      <div className="results glass">
        <span className="muted">Final score</span>
        <div className="results-score">{score.toLocaleString()}</div>
        <div className="results-rating">
          <span>{rating.emoji}</span> {rating.title}
        </div>
        <p className="results-blurb">{rating.blurb}</p>
        <p className="muted">
          {isNewBest ? <span className="badge">New personal best</span> : <>Personal best {best.toLocaleString()}</>}
        </p>

        <ul className="results-list">
          {results.map((r, i) => (
            <li key={r.country.code} style={{ animationDelay: `${i * 45}ms` }}>
              <span className="flag">{flagEmoji(r.country.cca2)}</span>
              <span className="results-name">
                <b>{r.country.name}</b>
                <small>{r.country.capital}</small>
              </span>
              <span className="results-km">{formatKm(r.km)}</span>
              <span className="results-bar">
                <i
                  style={{
                    width: `${(r.points / MAX_SCORE_PER_ROUND) * 100}%`,
                    background: scoreColor(r.points),
                  }}
                />
              </span>
              <b className="results-pts">{r.points.toLocaleString()}</b>
            </li>
          ))}
        </ul>

        {onSave && <SaveScore onSave={onSave} onLeaderboard={onLeaderboard} onAccount={onAccount} user={user} />}

        <div className="dock-row">
          <button className="btn btn-ghost btn-lg" onClick={onHome}>
            Home
          </button>
          <button className="btn btn-primary btn-lg" onClick={onRestart} autoFocus={!onSave}>
            Play again <kbd>↵</kbd>
          </button>
        </div>
      </div>
    </>
  )
}

function SaveScore({ onSave, onLeaderboard, onAccount, user }) {
  // A signed-in player already has an identity: reuse their saved name and only
  // ask when they have none yet (or want to change it). Guests get an optional field.
  const account = user && !user.is_anonymous ? user : null
  const savedName = (account?.user_metadata?.display_name || localStorage.getItem('pinpoint:name') || '').trim()
  const [name, setName] = useState(savedName)
  const [editing, setEditing] = useState(false)
  const askName = !account || !savedName || editing
  const [status, setStatus] = useState('idle') // idle | saving | saved | error
  const [rank, setRank] = useState(null) // { rank, total } once saved

  const submit = async (e) => {
    e.preventDefault()
    setStatus('saving')
    try {
      setRank(await onSave(name.trim()))
      setStatus('saved')
    } catch (err) {
      console.error('Could not save score', err)
      setStatus('error')
    }
  }

  if (status === 'saved') {
    return (
      <div className="save">
        <span className="badge">Score saved</span>
        {rank && (
          <p className="save-rank">
            You're <b>#{rank.rank}</b> of {rank.total.toLocaleString()} {rank.total === 1 ? 'game' : 'games'}
          </p>
        )}
        <button className="btn btn-ghost" onClick={onLeaderboard}>
          View leaderboard
        </button>
        {onAccount && user?.is_anonymous && (
          <button className="btn btn-ghost" onClick={onAccount}>
            Sign in to keep your scores
          </button>
        )}
      </div>
    )
  }

  return (
    <form className="save" onSubmit={submit}>
      {askName && (
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder={account ? 'Pick a display name' : 'Display name (optional)'}
          aria-label="Display name"
          autoFocus={editing}
          disabled={status === 'saving'}
        />
      )}
      <button className="btn btn-primary" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : askName ? 'Submit score' : `Submit as ${name}`}
      </button>
      {!askName && status !== 'saving' && (
        <button type="button" className="link-btn" onClick={() => setEditing(true)}>
          Change name
        </button>
      )}
      {status === 'error' && <span className="save-error">Couldn't save. Try again.</span>}
    </form>
  )
}

export function SignInModal({ user, onClose }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [kind, setKind] = useState('upgrade') // which email was sent
  const [error, setError] = useState('')
  const account = user && !user.is_anonymous ? user : null

  const submit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      setKind(await sendMagicLink(email.trim()))
      setStatus('sent')
    } catch (err) {
      console.error('Could not send magic link', err)
      setError(err.message || 'Something went wrong.')
      setStatus('error')
    }
  }

  let body
  if (account) {
    body = (
      <>
        <p className="muted">Signed in as</p>
        <b className="account-email">{account.email}</b>
        <p className="muted modal-note">Your scores are tied to this account on any device.</p>
        <div className="dock-row">
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await signOut()
              onClose()
            }}
          >
            Sign out
          </button>
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Done
          </button>
        </div>
      </>
    )
  } else if (status === 'sent') {
    body = (
      <>
        <p className="modal-note">
          Check <b>{email.trim()}</b> for {kind === 'upgrade' ? 'a confirmation' : 'a sign-in'} link. Open it in this
          browser to finish.
        </p>
        <button className="btn btn-primary" onClick={onClose} autoFocus>
          Got it
        </button>
      </>
    )
  } else {
    body = (
      <form className="signin-form" onSubmit={submit}>
        <p className="muted modal-note">
          Play as a guest or sign in with your email to keep your scores across devices. No password needed.
        </p>
        <input
          className="input"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          disabled={status === 'sending'}
        />
        <button className="btn btn-primary" disabled={status === 'sending' || !email.trim()}>
          {status === 'sending' ? 'Sending…' : 'Email me a link'}
        </button>
        {status === 'error' && <span className="save-error">{error}</span>}
      </form>
    )
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="results glass howto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="signin-title" className="board-title">
          {account ? 'Your account' : 'Sign in'}
        </h2>
        {body}
      </div>
    </div>
  )
}

export function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast glass">
          <span className="brand-dot" /> {t.text}
        </div>
      ))}
    </div>
  )
}

export function HowToPlay({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="results glass howto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="howto-title" className="board-title">
          How to play
        </h2>
        <ol className="howto-steps">
          <li>
            <span className="howto-n">1</span>
            <p>
              You get a country and have to find its <b>capital</b>. There are 10 rounds.
            </p>
          </li>
          <li>
            <span className="howto-n">2</span>
            <p>
              <b>Drag</b> to spin the globe and <b>scroll</b> to zoom. <b>Click</b> to drop your pin, and click
              again to move it.
            </p>
          </li>
          <li>
            <span className="howto-n">3</span>
            <p>
              Press <b>Lock in guess</b> (or <kbd>↵</kbd>) to see the real capital and how far off you were.
            </p>
          </li>
          <li>
            <span className="howto-n">4</span>
            <p>
              Closer is better: <b>1,000 points</b> within 50 km, fading with distance. Max score is{' '}
              <b>10,000</b>.
            </p>
          </li>
          <li>
            <span className="howto-n">5</span>
            <p>Finish a game and submit your score to the live leaderboard. No account needed.</p>
          </li>
        </ol>
        <button className="btn btn-primary" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  )
}

export function Leaderboard({ meId, onBack }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    let loaded = false
    const live = [] // inserts that arrive while the first fetch is in flight
    // Subscribe first so an insert landing during the initial fetch isn't missed.
    const unsubscribe = subscribeToScores((row) => {
      if (!loaded) live.push(row)
      else setRows((prev) => topScores([...prev, row]))
    })
    fetchTopScores()
      .then((data) => {
        if (!active) return
        loaded = true
        setRows(topScores([...data, ...live]))
      })
      .catch((e) => {
        console.error('Could not load leaderboard', e)
        active && setError(true)
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="overlay">
      <div className="results glass">
        <h2 className="board-title">Leaderboard</h2>
        <span className="muted">Top {LEADERBOARD_SIZE} · updates live</span>

        {error && <p className="save-error">Couldn't load the leaderboard.</p>}
        {!error && rows === null && <p className="muted">Loading…</p>}
        {rows?.length === 0 && <p className="muted">No scores yet. Be the first!</p>}

        {rows?.length > 0 && (
          <ol className="board">
            {rows.map((r, i) => (
              <li key={r.id} className={r.user_id === meId ? 'board-me' : undefined}>
                <span className="board-rank">{i + 1}</span>
                <span className="board-name">{r.display_name || 'Anonymous'}</span>
                <b className="results-pts">{r.points.toLocaleString()}</b>
              </li>
            ))}
          </ol>
        )}

        <button className="btn btn-primary" onClick={onBack} autoFocus>
          Back
        </button>
      </div>
    </div>
  )
}

function topScores(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return [...byId.values()]
    .sort((a, b) => b.points - a.points || a.created_at.localeCompare(b.created_at))
    .slice(0, LEADERBOARD_SIZE)
}
