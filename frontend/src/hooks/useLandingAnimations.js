import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'

/**
 * Tasteful GSAP polish for the landing page: a staggered hero entrance — the
 * photo reveals with a soft zoom, then the eyebrow, headline, location,
 * paragraph, button and stats rise into place one after another.
 *
 * Scoped to the hero only; the sections below keep their existing <Reveal>
 * scroll-in and the photos keep their CSS hover-zoom, so nothing double-runs.
 *
 * The `ran` ref makes the timeline fire exactly once per real mount — React
 * StrictMode's dev double-invoke of the effect is skipped, which avoids the
 * classic gsap "stuck at the zeroed start state" flake. It's a one-shot
 * entrance, so there's nothing to revert on unmount.
 *
 * Honours prefers-reduced-motion (does nothing); useLayoutEffect runs before
 * paint so the from-state is set with no flash of the un-animated hero.
 */
export function useLandingAnimations() {
  const ran = useRef(false)
  useLayoutEffect(() => {
    if (ran.current) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!document.querySelector('.hero-img-side')) return
    ran.current = true

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.hero-img-side',
        { autoAlpha: 0, scale: 1.06 },
        { autoAlpha: 1, scale: 1, duration: 1.1 })
      .fromTo('.hero-text-side > *',
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, '-=0.75')
  }, [])
}
