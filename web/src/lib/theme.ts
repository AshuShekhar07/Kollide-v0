import { festivalAt } from './festival'

// Light or dark, chosen in Settings and remembered on this device. The
// default, "festival", follows Bangalore's clock: cream by day, and the dark
// garba-night look from 6pm until 5am. "system" follows the phone.
// index.html applies the saved choice before the first paint (keep the two
// in step), and this keeps it applied afterwards.

export type ThemePref = 'festival' | 'light' | 'dark' | 'system'

const KEY = 'kollide:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
// Page background per theme, for the browser/status bar.
const BAR = { light: '#fff4e4', dark: '#16090f' }

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'festival' || v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // Storage blocked (private mode): fall back to the default.
  }
  return 'festival'
}

function apply(pref: ThemePref) {
  const dark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia(DARK_QUERY).matches) ||
    (pref === 'festival' && festivalAt().isNight)
  const theme = dark ? 'dark' : 'light'
  if (document.documentElement.dataset.theme === theme) return
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme])
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    // Not remembered, but still applied for this visit.
  }
  apply(pref)
}

// Apply the saved choice, and re-apply when the phone's setting changes (for
// "system") or the clock passes 6pm or 5am (for "festival").
export function initTheme() {
  apply(getThemePref())
  window.matchMedia(DARK_QUERY).addEventListener('change', () => apply(getThemePref()))
  window.setInterval(() => apply(getThemePref()), 60_000)
}
