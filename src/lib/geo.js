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

export function verdictFor(km) {
  if (km <= 50) return { label: 'Bullseye', emoji: '🎯' }
  if (km <= 300) return { label: 'So close', emoji: '🔥' }
  if (km <= 1000) return { label: 'Not bad', emoji: '👌' }
  if (km <= 3000) return { label: 'Off a bit', emoji: '🧭' }
  return { label: 'Wrong side of the planet?', emoji: '🌊' }
}

export function ratingFor(total) {
  if (total >= 9000) return { title: 'Cartographer legend', emoji: '🏆' }
  if (total >= 7500) return { title: 'Master navigator', emoji: '🧭' }
  if (total >= 5500) return { title: 'Seasoned explorer', emoji: '🌍' }
  if (total >= 3500) return { title: 'Weekend wanderer', emoji: '🎒' }
  return { title: 'Lost at sea', emoji: '🌊' }
}

// Colour for a round's score, used by the progress segments and result bars.
export const scoreColor = (points) =>
  points >= 800 ? '#3ecf8e' : points >= 400 ? '#ffb454' : '#ff6b6b'
