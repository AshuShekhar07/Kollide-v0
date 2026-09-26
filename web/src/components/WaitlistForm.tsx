import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type State = 'idle' | 'submitting' | 'done' | 'error'

export default function WaitlistForm() {
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
      <p className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-medium text-white" role="status">
        You're on the list. We'll email you the moment Kollide opens.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-4 focus:ring-marigold-400/60"
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="rounded-full bg-marigold-400 px-6 py-3 font-semibold text-brand-900 transition hover:bg-marigold-500 disabled:opacity-60"
        >
          {state === 'submitting' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {state === 'error' && (
        <p className="mt-2 text-sm text-marigold-400" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
