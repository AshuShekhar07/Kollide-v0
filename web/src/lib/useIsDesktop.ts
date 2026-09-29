import { useSyncExternalStore } from 'react'

// Matches Tailwind's `lg` breakpoint, where the app switches to the sidebar
// layout.
const DESKTOP = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

// Whether the desktop layout is showing, kept in sync with the window.
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches)
}
