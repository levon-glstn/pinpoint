const toRad = (d) => (d * Math.PI) / 180
const toDeg = (r) => (r * 180) / Math.PI

export function haversineKm(a, b) {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Point halfway along the great circle between a and b.
export function midpoint(a, b) {
  const vec = ({ lat, lng }) => [
    Math.cos(toRad(lat)) * Math.cos(toRad(lng)),
    Math.cos(toRad(lat)) * Math.sin(toRad(lng)),
    Math.sin(toRad(lat)),
  ]
  const [x1, y1, z1] = vec(a)
  const [x2, y2, z2] = vec(b)
  const x = x1 + x2
  const y = y1 + y2
  const z = z1 + z2
  if (Math.hypot(x, y, z) < 1e-6) return a // antipodal points
  return { lat: toDeg(Math.atan2(z, Math.hypot(x, y))), lng: toDeg(Math.atan2(y, x)) }
}

// Camera altitude (in globe radii) that fits a guess `km` away from the answer.
export const altitudeForDistance = (km) => Math.min(2.6, 0.55 + km / 9000)

// 1000 within 50 km, then a smooth exponential falloff (~510 at 1,000 km, ~130 at 3,000 km).
export const scoreForDistance = (km) =>
  km <= 50 ? 1000 : Math.round(1000 * Math.exp(-(km - 50) / 1500))

export const MAX_SCORE_PER_ROUND = 1000

export const flagEmoji = (cca2) =>
  [...cca2.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')

export function shuffled(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const formatKm = (km) => (km < 1 ? '<1 km' : `${Math.round(km).toLocaleString()} km`)

// Funny reactions. Lines are picked from the distance itself, so a given guess
// always gets the same joke (no re-roll on re-render) while different guesses vary.
const pick = (list, km) => list[Math.round(km) % list.length]

const BULLSEYE_LABELS = ['HUUUUUUGE KUDOS!!!', 'BUUUULLSEYE!!!', 'ARE YOU A SATELLITE?!', 'ABSOLUTELY UNREAL!!!']
const BULLSEYE_SUBS = [
  'Google Maps wants its job back.',
  'Cartographers everywhere are sweating.',
  'Legend. Absolute legend.',
  'Did you cheat? (Respect either way.)',
  'Somewhere, a geography teacher just cried happy tears.',
]
const FAR_LABELS = [
  'Wrong side of the planet?',
  'Did you even LOOK at the globe?',
  'Bold. Wrong, but bold.',
  'Geography is crying.',
  'Interesting strategy. Terrible, but interesting.',
]
const OFF_SUBS = ['The globe is round, you know.', 'Closer to a different country entirely.', 'A for effort. Mostly E.']
const EARTH_HALF_KM = 20015 // distance to the exact opposite side of the planet
const JET_KMH = 900

const CONFETTI = ['🎉', '🎯', '🏆', '🔥', '⭐', '🥳', '👏', '💥']
const GIGGLES = ['😂', '🤣', '😅', '🫠', '😭', '🙃', '😆', '💀', '😹']

export function verdictFor(km) {
  if (km <= 50)
    return {
      tier: 'bullseye',
      emoji: '🎯',
      label: pick(BULLSEYE_LABELS, km),
      sub: pick(BULLSEYE_SUBS, km),
      burst: { emojis: CONFETTI, count: 40, mode: 'pop' },
    }
  if (km <= 300)
    return {
      tier: 'close',
      emoji: '🔥',
      label: 'SO CLOSE!',
      sub: 'Chef’s kiss. Almost.',
      burst: { emojis: ['🔥', '👏', '😎', '✨'], count: 14, mode: 'pop' },
    }
  if (km <= 1000) return { tier: 'ok', emoji: '👌', label: 'Not bad', sub: null, burst: null }
  if (km <= 3000)
    return {
      tier: 'off',
      emoji: '🧭',
      label: 'Off a bit',
      sub: pick(OFF_SUBS, km),
      burst: { emojis: ['😬', '🧭', '🤏'], count: 8, mode: 'rain' },
    }
  const hours = km / JET_KMH
  const sub =
    km > 10000
      ? `That’s ${Math.min(100, Math.round((km / EARTH_HALF_KM) * 100))}% of the way to the exact opposite side of the planet. 🕳️`
      : `A jet would need ~${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours to fix that guess. ✈️`
  return {
    tier: 'far',
    emoji: '😂🤣😅',
    label: pick(FAR_LABELS, km),
    sub,
    burst: { emojis: GIGGLES, count: 44, mode: 'rain' },
  }
}

export function ratingFor(total) {
  if (total >= 9000)
    return {
      title: 'Cartographer legend',
      emoji: '🏆',
      blurb: 'Cartographers hate you. (They’re just jealous.)',
      burst: { emojis: CONFETTI, count: 50, mode: 'pop' },
    }
  if (total >= 7500)
    return {
      title: 'Master navigator',
      emoji: '🧭',
      blurb: 'Magellan would hire you on the spot.',
      burst: { emojis: ['🎉', '🧭', '👏', '✨'], count: 24, mode: 'pop' },
    }
  if (total >= 5500)
    return { title: 'Seasoned explorer', emoji: '🌍', blurb: 'Respectable. Your globe has seen things.', burst: null }
  if (total >= 3500)
    return { title: 'Weekend wanderer', emoji: '🎒', blurb: 'You know where Europe is. Probably.', burst: null }
  return {
    title: 'Lost at sea',
    emoji: '🌊',
    blurb: 'Have you considered… a map? Or glasses?',
    burst: { emojis: ['🌊', '🐟', '😅', '🛟', '🦈'], count: 30, mode: 'rain' },
  }
}

// Colour for a round's score, used by the progress segments and result bars.
export const scoreColor = (points) =>
  points >= 800 ? '#3ecf8e' : points >= 400 ? '#ffb454' : '#ff6b6b'
