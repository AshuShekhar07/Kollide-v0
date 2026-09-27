import { useEffect, useState } from 'react'

// Install banner for the main app (§6.2). Android/Chrome gets the browser's
// own prompt; iPhone Safari has none, so it gets the Add to Home Screen steps.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISSED_KEY = 'kollide:install-dismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [hidden, setHidden] = useState(() => wasDismissed() || standalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* fine: it just shows again next visit */
    }
  }

  async function install() {
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    setEvent(null)
    if (outcome === 'accepted') setHidden(true)
  }

  if (hidden || (!event && !isIos())) return null

  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900" role="status">
      <img src="/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-xl" />
      <p className="min-w-0 flex-1">
        {event ? (
          'Add Kollide to your home screen for quick access.'
        ) : (
          <>
            Add Kollide to your home screen: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          </>
        )}
      </p>
      {event && (
        <button type="button" onClick={install} className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 font-semibold text-white">
          Install
        </button>
      )}
      <button type="button" onClick={dismiss} className="shrink-0 px-1 text-lg leading-none text-brand-700" aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
