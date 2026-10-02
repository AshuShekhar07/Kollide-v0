import { Check, Plus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { MAX_ANSWER, MAX_ANSWERS, MAX_INTRO, MIN_INTRO, fetchAnswers, fetchPrompts, type Answer, type Prompt } from '../lib/about'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Button, ErrorText, Spinner, inputClass } from './ui'

// Intro plus up to 3 answered questions, saved together by save_about().
export default function AboutEditor({
  uid,
  bio,
  submitLabel,
  onSaved,
  secondary,
}: {
  uid: string
  bio: string | null
  submitLabel: string
  onSaved: () => void | Promise<void>
  secondary?: ReactNode
}) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null)
  const [intro, setIntro] = useState(bio ?? '')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchPrompts(), fetchAnswers(uid)])
      .then(([p, a]) => {
        setPrompts(p)
        setAnswers(a.map(({ prompt_key, answer }) => ({ prompt_key, answer })))
      })
      .catch((e) => setError(friendlyError(e)))
  }, [uid])

  function change(fn: () => void) {
    setSaved(false)
    setError('')
    fn()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (intro.trim().length < MIN_INTRO) return setError('Tell people a little more about yourself.')
    if (answers.some((a) => !a.answer.trim())) return setError('Answer each question you picked, or remove it.')
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('save_about', { p_bio: intro, p_answers: answers })
    if (error) {
      setBusy(false)
      return setError(friendlyError(error))
    }
    await onSaved()
    setBusy(false)
    setSaved(true)
  }

  if (!prompts) return error ? <ErrorText>{error}</ErrorText> : <Spinner />
  const question = (key: string) => prompts.find((p) => p.key === key)?.question ?? ''
  const available = prompts.filter((p) => !answers.some((a) => a.prompt_key === p.key))

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-neutral-800">About me</span>
        <textarea
          value={intro}
          onChange={(e) => change(() => setIntro(e.target.value))}
          maxLength={MAX_INTRO}
          rows={4}
          placeholder="Who you are, what you do, and what you enjoy. E.g. Product designer, new in town, can't sit still when the dhol starts."
          className={inputClass}
        />
        <span className="mt-1.5 flex justify-between text-xs text-neutral-500">
          <span>Who you are, what you do, what you enjoy.</span>
          <span className={intro.length > MAX_INTRO - 50 ? 'font-semibold text-marigold-600' : ''}>
            {intro.length}/{MAX_INTRO}
          </span>
        </span>
      </label>

      <div>
        <p className="flex items-center justify-between text-sm font-semibold text-neutral-800">
          <span>
            Questions <span className="font-normal text-neutral-500">(optional)</span>
          </span>
          <span className="flex gap-1" aria-label={`${answers.length} of ${MAX_ANSWERS} answered`}>
            {Array.from({ length: MAX_ANSWERS }, (_, i) => (
              <span key={i} className={`h-2 w-5 rounded-full ${i < answers.length ? 'bg-brand-500' : 'bg-neutral-200'}`} />
            ))}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">Answer up to {MAX_ANSWERS}. They give people something to talk about.</p>
        <ul className="mt-2 space-y-3">
          {answers.map((a, i) => (
            <li key={a.prompt_key} className="animate-rise rounded-3xl border border-brand-200 bg-brand-50 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-[15px] font-bold text-brand-800">{question(a.prompt_key)}</p>
                <button
                  type="button"
                  onClick={() => change(() => setAnswers((cur) => cur.filter((_, j) => j !== i)))}
                  aria-label={`Remove "${question(a.prompt_key)}"`}
                  className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-surface hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={a.answer}
                onChange={(e) =>
                  change(() => setAnswers((cur) => cur.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x))))
                }
                maxLength={MAX_ANSWER}
                rows={2}
                aria-label={question(a.prompt_key)}
                className={`${inputClass} mt-2`}
              />
            </li>
          ))}
        </ul>

        {answers.length < MAX_ANSWERS &&
          (picking ? (
            <div className="mt-3 animate-rise rounded-3xl border border-neutral-200 bg-surface p-2 shadow-lg">
              <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">Pick a question</p>
              <ul className="max-h-72 overflow-y-auto">
                {available.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() =>
                        change(() => {
                          setAnswers((cur) => [...cur, { prompt_key: p.key, answer: '' }])
                          setPicking(false)
                        })
                      }
                      className="w-full rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-neutral-800 hover:bg-brand-50"
                    >
                      {p.question}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setPicking(false)} className="w-full py-2 text-sm font-medium text-neutral-500">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-300 px-4 py-3.5 text-sm font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50 active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Add a question
            </button>
          ))}
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-3">
        {secondary}
        <Button type="submit" className="flex-1" loading={busy}>
          {saved ? (
            <>
              <Check className="h-4 w-4" strokeWidth={3} /> Saved
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  )
}
