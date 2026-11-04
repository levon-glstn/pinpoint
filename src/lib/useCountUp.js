import { useEffect, useRef, useState } from 'react'

// Animates a number towards `target` (ease-out cubic).
export function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - (1 - t) ** 3
      const v = Math.round(begin + (target - begin) * eased)
      from.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])

  return value
}
