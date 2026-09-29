import { PartyPopper } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type State = 'idle' | 'submitting' | 'done' | 'error'

// `dark` sits on a deep background; `light` on the landing page's cream.
export default function WaitlistForm({ id = 'waitlist-email', tone = 'dark' }: { id?: string; tone?: 'dark' | 'light' }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState('submitting')
    const { error } = await supabase.rpc('join_waitlist', { p_email: email })
    if (error) {
      // 22023 is the RPC's own validation error; anything else is unexpected.
      setError(error.code === '22023' ? error.message : 'Something went wrong. Please try again.')
      setState('error')
      return
    }
    setState('done')
  }

  if (state === 'done') {
    return (
      <p
        className={`flex animate-pop items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
          tone === 'dark' ? 'bg-white/15 text-white ring-1 ring-white/25' : 'bg-[#2A0E1B]/5 text-[#2A0E1B] ring-1 ring-[#2A0E1B]/15'
        }`}
        role="status"
      >
        <PartyPopper className={`h-5 w-5 shrink-0 ${tone === 'dark' ? 'text-marigold-300' : 'text-[#E0661A]'}`} />
        You're on the list. We'll email you when the Kollide app is out.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`min-w-0 flex-1 rounded-full bg-white px-5 py-3.5 text-maroon-950 shadow-lg shadow-black/10 ${
            tone === 'light' ? 'ring-1 ring-[#2A0E1B]/15' : ''
          } placeholder:text-[#8a7d72] focus:outline-none focus:ring-4 focus:ring-marigold-400/60`}
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="rounded-full bg-marigold-400 px-6 py-3.5 font-bold text-maroon-950 shadow-lg shadow-marigold-500/30 transition hover:brightness-105 active:scale-[0.97] disabled:opacity-60"
        >
          {state === 'submitting' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {state === 'error' && (
        <p className={`mt-2 text-sm font-medium ${tone === 'dark' ? 'text-marigold-300' : 'text-[#A8450C]'}`} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
