import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import fallbackCountries from './data/countries.json'
import GlobeStage from './components/GlobeStage.jsx'
import {
  GuessDock,
  HowToPlay,
  Intro,
  Leaderboard,
  PromptCard,
  RevealCard,
  Results,
  SignInModal,
  Toasts,
  TopBar,
} from './components/Screens.jsx'
import { altitudeForDistance, haversineKm, midpoint, scoreForDistance, shuffled } from './lib/geo.js'
import {
  backendEnabled,
  ensureSession,
  fetchCountries,
  fetchRank,
  submitScore,
  subscribeToScores,
  watchUser,
} from './lib/supabase.js'

const ROUNDS = 10
const BEST_KEY = 'pinpoint:best'
const NAME_KEY = 'pinpoint:name'
const TOAST_MS = 5000
const MAX_TOASTS = 3

export default function App() {
  const [phase, setPhase] = useState('intro') // intro | guess | reveal | done | leaderboard
  const [boardFrom, setBoardFrom] = useState('intro') // screen the leaderboard returns to
  const [deck, setDeck] = useState([])
  const [round, setRound] = useState(0)
  const [guess, setGuess] = useState(null)
  const [results, setResults] = useState([])
  const [focus, setFocus] = useState(null)
  const [shapes, setShapes] = useState([])
  const [countries, setCountries] = useState(null) // null until loaded
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) || 0))
  const [isNewBest, setIsNewBest] = useState(false)
  const [modal, setModal] = useState(null) // null | 'help' | 'signin'
  const [user, setUser] = useState(null) // current auth user (guest or signed in), if any
  const [toasts, setToasts] = useState([]) // live "someone just scored" notices
  const [saved, setSaved] = useState(false) // this game's score already submitted

  useEffect(() => {
    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((fc) => setShapes(fc.features))
      .catch((e) => console.error('Could not load country shapes', e))
  }, [])

  // Countries come from the Supabase table; the bundled JSON is only a fallback
  // for when the backend is unconfigured or unreachable.
  useEffect(() => {
    if (!backendEnabled) return setCountries(fallbackCountries)
    fetchCountries()
      .then((rows) => setCountries(rows.length ? rows : fallbackCountries))
      .catch((e) => {
        console.error('Could not load countries from Supabase, using local copy', e)
        setCountries(fallbackCountries)
      })
  }, [])

  // Track the auth user; no sign-in happens here (that is when a game starts).
  useEffect(() => (backendEnabled ? watchUser(setUser) : undefined), [])

  // Live activity feed: toast other players' new scores on any screen.
  const userIdRef = useRef(null)
  userIdRef.current = user?.id ?? null
  useEffect(() => {
    if (!backendEnabled) return
    return subscribeToScores((row) => {
      if (row.user_id === userIdRef.current) return // your own score has its own UI
      const id = row.id
      const text = `${row.display_name || 'Someone'} just scored ${row.points.toLocaleString()}`
      setToasts((t) => [...t.filter((x) => x.id !== id), { id, text }].slice(-MAX_TOASTS))
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS)
    })
  }, [])

  const target = deck[round]
  const total = useMemo(() => results.reduce((sum, r) => sum + r.points, 0), [results])

  const start = useCallback(() => {
    if (!countries) return
    setDeck(shuffled(countries).slice(0, ROUNDS))
    setRound(0)
    setResults([])
    setGuess(null)
    setIsNewBest(false)
    setSaved(false)
    setPhase('guess')
    setFocus({ altitude: 2.0 })
    // Anonymous sign-in in the background; the game never waits on it.
    ensureSession().catch((e) => console.error('Anonymous sign-in failed', e))
  }, [countries])

  const save = useCallback(
    async (name) => {
      if (saved) return
      const row = await submitScore(total, name)
      localStorage.setItem(NAME_KEY, name)
      setSaved(true)
      // The score is already saved; a failed rank lookup just means no rank line.
      return fetchRank(row).catch((e) => {
        console.error('Could not fetch rank', e)
        return null
      })
    },
    [saved, total],
  )

  const goHome = useCallback(() => {
    setPhase('intro')
    setDeck([])
    setResults([])
    setGuess(null)
  }, [])

  const openBoard = useCallback(() => {
    setBoardFrom(phase === 'done' ? 'done' : 'intro')
    setPhase('leaderboard')
  }, [phase])

  const pick = useCallback((lat, lng) => setGuess({ lat, lng }), [])

  const confirm = useCallback(() => {
    if (phase !== 'guess' || !guess) return
    const km = haversineKm(guess, target)
    const mid = midpoint(guess, target)
    setResults((r) => [...r, { country: target, guess, km, points: scoreForDistance(km) }])
    setPhase('reveal')
    setFocus({ ...mid, altitude: altitudeForDistance(km) })
  }, [phase, guess, target])

  const next = useCallback(() => {
    if (phase !== 'reveal') return
    if (round + 1 >= ROUNDS) {
      const finalScore = results.reduce((s, r) => s + r.points, 0)
      if (finalScore > best) {
        localStorage.setItem(BEST_KEY, String(finalScore))
        setBest(finalScore)
        setIsNewBest(true)
      }
      setPhase('done')
      setFocus({ lat: 20, lng: 10, altitude: 3.0, ms: 1800 })
    } else {
      setRound(round + 1)
      setGuess(null)
      setPhase('guess')
      setFocus({ altitude: 2.0 })
    }
  }, [phase, round, results, best])

  // Enter drives the primary action on every screen.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.repeat) return
      // Leave the save-score form (name input, submit button) to its own Enter handling.
      if (e.target.closest?.('.save')) return
      e.preventDefault() // stops a focused button from also firing its own click
      if (modal) return // modals handle Enter themselves
      if (phase === 'leaderboard') setPhase(boardFrom)
      else if (phase === 'guess') confirm()
      else if (phase === 'reveal') next()
      else if (phase === 'done') start()
      else if (phase === 'intro') start()
    }
    const onEsc = (e) => e.key === 'Escape' && setModal(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onEsc)
    }
  }, [phase, modal, boardFrom, confirm, next, start])

  const inGame = phase === 'guess' || phase === 'reveal'

  return (
    <>
      <GlobeStage
        phase={phase === 'leaderboard' ? boardFrom : phase}
        guess={guess}
        target={inGame ? target : null}
        shapes={shapes}
        focus={focus}
        onPick={pick}
      />
      <div className="shade" />

      {phase === 'intro' && <Intro best={best} rounds={ROUNDS} onPlay={start}
          loading={!countries}
          onHelp={() => setModal('help')}
          onAccount={backendEnabled ? () => setModal('signin') : undefined}
          user={user}
          onLeaderboard={backendEnabled ? openBoard : undefined} />}

      {inGame && (
        <>
          <TopBar round={round} rounds={ROUNDS} results={results} total={total} />
          {phase === 'guess' && (
            <>
              <PromptCard country={target} round={round} hasGuess={!!guess} />
              <GuessDock hasGuess={!!guess} onConfirm={confirm} />
            </>
          )}
          {phase === 'reveal' && (
            <RevealCard result={results[results.length - 1]} isLast={round + 1 >= ROUNDS} onNext={next} />
          )}
        </>
      )}

      {phase === 'done' && (
        <div className="overlay">
          <Results
            results={results}
            total={total}
            best={best}
            isNewBest={isNewBest}
            onRestart={start}
            onHome={goHome}
            onSave={backendEnabled ? save : undefined}
            onAccount={backendEnabled ? () => setModal('signin') : undefined}
            user={user}
            onLeaderboard={backendEnabled ? openBoard : undefined}
          />
        </div>
      )}

      <Toasts toasts={toasts} />

      {modal === 'help' && <HowToPlay onClose={() => setModal(null)} />}
      {modal === 'signin' && <SignInModal user={user} onClose={() => setModal(null)} />}

      {phase === 'leaderboard' && <Leaderboard meId={user?.id} onBack={() => setPhase(boardFrom)} />}
    </>
  )
}
