import { supabase } from './supabase'

export type Prompt = { key: string; question: string }
export type Answer = { prompt_key: string; answer: string }
export type ShownAnswer = Answer & { question: string }

export const MAX_ANSWERS = 3
export const MAX_INTRO = 500
export const MIN_INTRO = 10
export const MAX_ANSWER = 200

export async function fetchPrompts(): Promise<Prompt[]> {
  const { data, error } = await supabase.from('prompts').select('key, question').eq('active', true).order('sort_order')
  if (error) throw error
  return data
}

// RLS only returns answers for profiles the caller may see.
export async function fetchAnswers(userId: string): Promise<ShownAnswer[]> {
  const { data, error } = await supabase
    .from('profile_answers')
    .select('prompt_key, answer, prompts(question)')
    .eq('user_id', userId)
    .order('position')
  if (error) throw error
  return data.map((a) => ({ prompt_key: a.prompt_key, answer: a.answer, question: a.prompts.question }))
}
