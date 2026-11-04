// Builds the game's data files from open datasets:
//   src/data/countries.json        -> [{ code, cca2, name, capital, lat, lng, region }]
//   public/data/countries.geojson  -> simplified country shapes for the globe
//
// Run with: npm run build:data

import { writeFile } from 'node:fs/promises'

const SRC = {
  countries: 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json',
  places:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson',
  shapes:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
}

// Natural Earth is missing or outdated for a few capitals.
const CAPITAL_OVERRIDES = {
  BDI: { capital: 'Gitega', lat: -3.4271, lng: 29.9246 },
  KAZ: { capital: 'Astana', lat: 51.1694, lng: 71.4491 },
  NRU: { capital: 'Yaren', lat: -0.5477, lng: 166.9209 },
  PLW: { capital: 'Ngerulmud', lat: 7.5006, lng: 134.6242 },
  AND: { capital: 'Andorra la Vella', lat: 42.5063, lng: 1.5218 },
  GRD: { capital: "St. George's", lat: 12.0561, lng: -61.7488 },
  GNQ: { capital: 'Malabo' },
  KIR: { capital: 'Tarawa' },
  SMR: { capital: 'San Marino' },
  MNG: { capital: 'Ulaanbaatar' },
  USA: { capital: 'Washington, D.C.' },
}

// Natural Earth uses a few non-ISO codes.
const SHAPE_CODE_FIXES = { SDS: 'SSD', KOS: 'XKX' }

const getJson = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

const round = (n) => Math.round(n * 100) / 100
const roundCoords = (c) => (typeof c[0] === 'number' ? c.map(round) : c.map(roundCoords))

const [countries, places, shapes] = await Promise.all([
  getJson(SRC.countries),
  getJson(SRC.places),
  getJson(SRC.shapes),
])

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

const placesByCode = new Map()
for (const f of places.features) {
  const p = f.properties
  if (!placesByCode.has(p.adm0_a3)) placesByCode.set(p.adm0_a3, [])
  placesByCode.get(p.adm0_a3).push(p)
}

// Coordinates are looked up by capital *name* so name and location always agree
// (Natural Earth flags e.g. Cape Town / La Paz as the capital, our names say Pretoria / Sucre).
const findPlace = (code, capitalName) => {
  const want = norm(capitalName)
  return (placesByCode.get(code) ?? []).find((p) =>
    [p.name, p.nameascii, p.namealt, p.namepar].some((n) => norm(n) === want),
  )
}

const rows = []
const fallbacks = []
for (const c of countries.filter((c) => c.unMember)) {
  const override = CAPITAL_OVERRIDES[c.cca3] ?? {}
  const capital = override.capital ?? c.capital?.[0]
  let lat = override.lat
  let lng = override.lng
  let name = capital

  if (lat == null) {
    const hit = findPlace(c.cca3, capital)
    if (hit) {
      lat = hit.latitude
      lng = hit.longitude
    } else {
      // Fall back to whatever Natural Earth calls the capital, keeping name + coords consistent.
      const ne = (placesByCode.get(c.cca3) ?? []).find((p) => p.featurecla.startsWith('Admin-0 capital'))
      if (!ne) throw new Error(`No coordinates for ${c.name.common} / ${capital}`)
      fallbacks.push(`${c.name.common}: ${capital} -> ${ne.name}`)
      lat = ne.latitude
      lng = ne.longitude
      name = ne.name
    }
  }
  rows.push({
    code: c.cca3,
    cca2: c.cca2,
    name: c.name.common,
    capital: name,
    lat: round(lat),
    lng: round(lng),
    region: c.region,
  })
}
rows.sort((a, b) => a.name.localeCompare(b.name))

const features = shapes.features.map((f) => {
  const p = f.properties
  let code = p.ADM0_A3
  code = SHAPE_CODE_FIXES[code] ?? code
  return {
    type: 'Feature',
    properties: { code, name: p.NAME },
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  }
})

await writeFile('src/data/countries.json', JSON.stringify(rows, null, 1))
await writeFile('public/data/countries.geojson', JSON.stringify({ type: 'FeatureCollection', features }))

const shapeCodes = new Set(features.map((f) => f.properties.code))
console.log(`countries: ${rows.length}`)
console.log('name fallbacks:', fallbacks)
console.log('no shape on globe:', rows.filter((r) => !shapeCodes.has(r.code)).map((r) => r.name).join(', '))
