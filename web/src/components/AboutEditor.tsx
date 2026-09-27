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
        <span className="mb-1 block text-sm font-medium text-neutral-800">About me</span>
        <textarea
          value={intro}
          onChange={(e) => change(() => setIntro(e.target.value))}
          maxLength={MAX_INTRO}
          rows={4}
          placeholder="Who you are, what you do, and what you enjoy. E.g. Product designer, new to Bangalore, can't sit still when the dhol starts."
          className={inputClass}
        />
        <span className="mt-1 flex justify-between text-xs text-neutral-500">
          <span>Who you are, what you do, what you enjoy.</span>
          <span>
            {intro.length}/{MAX_INTRO}
          </span>
        </span>
      </label>

      <div>
        <p className="text-sm font-medium text-neutral-800">
          Questions <span className="font-normal text-neutral-500">(optional, up to {MAX_ANSWERS})</span>
        </p>
        <ul className="mt-2 space-y-3">
          {answers.map((a, i) => (
            <li key={a.prompt_key} className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-brand-700">{question(a.prompt_key)}</p>
                <button
                  type="button"
                  onClick={() => change(() => setAnswers((cur) => cur.filter((_, j) => j !== i)))}
                  className="shrink-0 text-xs font-medium text-neutral-500 hover:text-red-700"
                >
                  Remove
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
            <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase text-neutral-500">Pick a question</p>
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
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-800 hover:bg-brand-50"
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
            <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => setPicking(true)}>
              + Add a question
            </Button>
          ))}
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-3">
        {secondary}
        <Button type="submit" className="flex-1" loading={busy}>
          {saved ? 'Saved' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
