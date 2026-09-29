// Light or dark, chosen in Settings and remembered on this device. Light is
// the default; "system" follows the phone. index.html applies the saved
// choice before the first paint (keep the two in step), and this keeps it
// applied afterwards.

export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'kollide:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
// Page background per theme, for the browser/status bar.
const BAR = { light: '#fff4e4', dark: '#16090f' }

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // Storage blocked (private mode): fall back to the default.
  }
  return 'light'
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia(DARK_QUERY).matches)
  const theme = dark ? 'dark' : 'light'
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

// Apply the saved choice, and re-apply when the phone's setting changes (only
// matters for "system").
export function initTheme() {
  apply(getThemePref())
  window.matchMedia(DARK_QUERY).addEventListener('change', () => apply(getThemePref()))
}
