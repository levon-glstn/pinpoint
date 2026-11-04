import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { MeshPhongMaterial } from 'three'

const GUESS_RGB = '255,180,84'
const ANSWER_RGB = '62,207,142'

const OCEAN = '#10263f'
const LAND = 'rgba(28,43,64,0.96)'
const LAND_HOVER = 'rgba(62,207,142,0.38)'
const LAND_ANSWER = 'rgba(62,207,142,0.62)'
const BORDER = 'rgba(130,160,190,0.28)'

const START_VIEW = { lat: 20, lng: 10, altitude: 3.2 }

export default function GlobeStage({ phase, guess, target, shapes, focus, onPick }) {
  const globe = useRef()
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState(null)
  const oceanMaterial = useMemo(
    () => new MeshPhongMaterial({ color: OCEAN, emissive: '#0b1f35', shininess: 8 }),
    [],
  )
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleReady = () => {
    const g = globe.current
    const controls = g.controls()
    controls.minDistance = 115
    controls.maxDistance = 420
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 0.7
    g.pointOfView(START_VIEW, 0)
    setReady(true)
  }

  // Idle spin on the intro and results screens, still while playing.
  useEffect(() => {
    if (!ready) return
    const controls = globe.current.controls()
    controls.autoRotate = phase === 'intro' || phase === 'done'
    controls.autoRotateSpeed = 0.45
  }, [phase, ready])

  // Camera moves requested by the game.
  useEffect(() => {
    if (!ready || !focus) return
    const cur = globe.current.pointOfView()
    globe.current.pointOfView(
      {
        lat: focus.lat ?? cur.lat,
        lng: focus.lng ?? cur.lng,
        altitude: focus.altitude ?? cur.altitude,
      },
      focus.ms ?? 1400,
    )
  }, [focus, ready])

  const playing = phase === 'guess'

  const markers = useMemo(() => {
    const m = []
    if (guess) m.push({ ...guess, rgb: GUESS_RGB, r: 0.42 })
    if (phase === 'reveal' && target) m.push({ lat: target.lat, lng: target.lng, rgb: ANSWER_RGB, r: 0.5 })
    return m
  }, [guess, target, phase])

  const arcs = useMemo(
    () =>
      phase === 'reveal' && guess && target
        ? [{ startLat: guess.lat, startLng: guess.lng, endLat: target.lat, endLng: target.lng }]
        : [],
    [phase, guess, target],
  )

  const labels = useMemo(
    () => (phase === 'reveal' && target ? [{ lat: target.lat, lng: target.lng, text: target.capital }] : []),
    [phase, target],
  )

  const pick = (lat, lng) => {
    if (playing) onPick(lat, lng)
  }

  const isAnswer = (d) => phase === 'reveal' && target && d.properties.code === target.code

  return (
    <div className={`stage ${playing ? 'is-playing' : ''}`}>
      <Globe
        ref={globe}
        width={size.w}
        height={size.h}
        backgroundImageUrl="/img/night-sky.png"
        globeMaterial={oceanMaterial}
        atmosphereColor="#3ecf8e"
        atmosphereAltitude={0.17}
        onGlobeReady={handleReady}
        onGlobeClick={({ lat, lng }) => pick(lat, lng)}
        // countries
        polygonsData={shapes}
        polygonCapColor={(d) => (isAnswer(d) ? LAND_ANSWER : playing && d === hover ? LAND_HOVER : LAND)}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => BORDER}
        polygonAltitude={(d) => (isAnswer(d) ? 0.022 : playing && d === hover ? 0.014 : 0.005)}
        polygonsTransitionDuration={250}
        onPolygonHover={(d) => setHover(d ?? null)}
        onPolygonClick={(_, __, { lat, lng }) => pick(lat, lng)}
        // pins
        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d) => `rgb(${d.rgb})`}
        pointAltitude={0.05}
        pointRadius="r"
        pointsMerge={false}
        pointResolution={24}
        // pulsing rings under pins
        ringsData={markers}
        ringLat="lat"
        ringLng="lng"
        ringColor={(d) => (t) => `rgba(${d.rgb},${1 - t})`}
        ringMaxRadius={3.6}
        ringPropagationSpeed={1.8}
        ringRepeatPeriod={1300}
        // line from guess to answer
        arcsData={arcs}
        arcColor={() => [`rgba(${GUESS_RGB},0.95)`, `rgba(${ANSWER_RGB},0.95)`]}
        arcStroke={0.55}
        arcAltitudeAutoScale={0.35}
        arcDashLength={0.45}
        arcDashGap={0.18}
        arcDashAnimateTime={2200}
        arcsTransitionDuration={0}
        // capital name
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize={1.5}
        labelDotRadius={0.45}
        labelColor={() => '#eafff5'}
        labelAltitude={0.03}
        labelResolution={3}
      />
    </div>
  )
}
