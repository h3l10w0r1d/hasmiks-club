import { useEffect, useRef, useState } from 'react'

/** Fires once when the element first scrolls into view. SSR/no-IO safe. */
export function useReveal(options) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...options },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return [ref, visible]
}
