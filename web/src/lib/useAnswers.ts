import { useEffect, useState } from 'react'
import { fetchAnswers, type ShownAnswer } from './about'

// Someone's answered questions. Pass `given` when the caller already has
// them (get_group_member_profile returns them inline); otherwise they're
// fetched for `userId`. A failed fetch just shows none.
export function useAnswers(userId: string, given?: ShownAnswer[]) {
  const [fetched, setFetched] = useState<{ userId: string; answers: ShownAnswer[] } | null>(null)
  const preloaded = given !== undefined

  useEffect(() => {
    if (preloaded) return
    let cancelled = false
    fetchAnswers(userId)
      .then((answers) => !cancelled && setFetched({ userId, answers }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, preloaded])

  return given ?? (fetched?.userId === userId ? fetched.answers : [])
}
