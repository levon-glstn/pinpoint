import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Without env vars the game still plays; leaderboard features just switch off.
export const backendEnabled = Boolean(url && key)
export const supabase = backendEnabled ? createClient(url, key) : null

export const LEADERBOARD_SIZE = 20

// Anonymous sign-in, reusing the persisted session when there is one. Only the
// in-flight call is shared; the session itself is re-read each time so a later
// sign-in or sign-out is never masked by a stale cached value.
let inflight = null
export function ensureSession() {
  if (!supabase) return Promise.resolve(null)
  inflight ??= (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    const { data: signedIn, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return signedIn.session
  })().finally(() => {
    inflight = null
  })
  return inflight
}

// Calls back with the current user (or null) now and on every auth change,
// including sign-ins completed in another tab.
export function watchUser(onUser) {
  supabase.auth.getSession().then(({ data }) => onUser(data.session?.user ?? null))
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onUser(session?.user ?? null))
  return () => data.subscription.unsubscribe()
}

// GitHub sign-in. A guest has the identity linked to their anonymous user, so
// their user_id and scores are kept. Everyone else just signs in. Both redirect
// the browser to GitHub and back, so this only returns if something failed.
export async function signInWithGitHub() {
  const redirectTo = window.location.origin
  const { data } = await supabase.auth.getSession()
  const { error } = data.session?.user.is_anonymous
    ? await supabase.auth.linkIdentity({ provider: 'github', options: { redirectTo } })
    : await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
  if (error) throw error
}

// If a guest tried to link a GitHub account that already has an account (e.g.
// signing in on a new device after playing as a guest), Supabase redirects back
// with `identity_already_exists`. Sign in to that existing account instead,
// once, so it can't loop. Returns true when it redirected.
export function recoverFromExistingIdentity() {
  const params = new URLSearchParams(window.location.hash.slice(1) + '&' + window.location.search.slice(1))
  if (params.get('error_code') !== 'identity_already_exists') {
    sessionStorage.removeItem('pinpoint:oauth-retry') // a normal load: allow future retries
    return false
  }
  history.replaceState(null, '', window.location.pathname)
  if (sessionStorage.getItem('pinpoint:oauth-retry')) return false
  sessionStorage.setItem('pinpoint:oauth-retry', '1')
  supabase.auth
    .signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } })
    .catch((e) => console.error('GitHub sign-in retry failed', e))
  return true
}

// Remember the leaderboard name on the account itself (auth user metadata), so a
// signed-in player is asked once and the name follows them across devices.
export async function saveDisplayName(name) {
  const { error } = await supabase.auth.updateUser({ data: { display_name: name } })
  if (error) throw error
}

// Shown for a signed-in player: GitHub username if they used GitHub, else email.
export const accountLabel = (user) => user?.user_metadata?.user_name || user?.email || 'Signed in'

export function signOut() {
  return supabase.auth.signOut()
}

export async function submitScore(points, displayName) {
  await ensureSession()
  const { data, error } = await supabase
    .from('scores')
    .insert({ points, display_name: displayName || null })
    .select('id, user_id, display_name, points, created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchCountries() {
  const { data, error } = await supabase
    .from('countries')
    .select('code, cca2, name, capital, lat, lng, region')
    .order('name')
  if (error) throw error
  return data
}

export async function fetchTopScores() {
  const { data, error } = await supabase
    .from('scores')
    .select('id, user_id, display_name, points, created_at')
    .order('points', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(LEADERBOARD_SIZE)
  if (error) throw error
  return data
}

// Your place on the leaderboard, ordered exactly like the list itself
// (points desc, then oldest first). Counts the rows ahead of `row`.
export async function fetchRank({ points, created_at }) {
  const [ahead, all] = await Promise.all([
    supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .or(`points.gt.${points},and(points.eq.${points},created_at.lt.${created_at})`),
    supabase.from('scores').select('*', { count: 'exact', head: true }),
  ])
  const error = ahead.error || all.error
  if (error) throw error
  return { rank: ahead.count + 1, total: all.count }
}

// Live inserts. All callers share one Realtime channel, which is opened for the
// first listener and closed after the last one leaves. Returns an unsubscribe.
const scoreListeners = new Set()
let scoreChannel = null
let channelSeq = 0
export function subscribeToScores(onInsert) {
  scoreListeners.add(onInsert)
  // Unique topic per open: a channel being torn down must not be reused.
  scoreChannel ??= supabase
    .channel(`scores-inserts-${channelSeq++}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' }, (payload) =>
      scoreListeners.forEach((fn) => fn(payload.new)),
    )
    .subscribe()
  return () => {
    scoreListeners.delete(onInsert)
    if (scoreListeners.size === 0 && scoreChannel) {
      supabase.removeChannel(scoreChannel)
      scoreChannel = null
    }
  }
}
