import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShell } from '../components/AppShell'
import MatchDialog from '../components/MatchDialog'
import ProfileCard from '../components/ProfileCard'
import { Button, ErrorText, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { fetchLiveActivity, type Feed, type FeedProfile, type LiveActivity, type MatchResult } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { SEEKING_OPTIONS } from '../lib/profile-options'
import { supabase } from '../lib/supabase'

const BATCH = 20
const SWIPE_PX = 110
const SWIPE_VELOCITY = 600

type Dir = -1 | 1 // pass | like

const exitVariants = {
  exit: (d: Dir) => ({ x: d * 600, rotate: d * 20, opacity: 0, transition: { duration: 0.3 } }),
}

function SwipeCard({ profile, dir, onDecide }: { profile: FeedProfile; dir: Dir; onDecide: (d: Dir) => void }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 240], [-12, 12])
  const likeOpacity = useTransform(x, [30, SWIPE_PX], [0, 1])
  const passOpacity = useTransform(x, [-SWIPE_PX, -30], [1, 0])
  const [photo, setPhoto] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) onDecide(1)
    else if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) onDecide(-1)
  }

  // Tap the left/right half to step through photos (taps don't fire after a drag).
  function onTap(_: unknown, info: { point: { x: number } }) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const left = info.point.x - window.scrollX - rect.left < rect.width / 2
    setPhoto((p) => p + (left ? -1 : 1))
  }

  return (
    <motion.div
      ref={ref}
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      onTap={onTap}
      custom={dir}
      variants={exitVariants}
      exit="exit"
    >
      <ProfileCard profile={profile} photoIndex={photo} className="h-full w-full" />
      <motion.span
        style={{ opacity: likeOpacity }}
        className="absolute left-5 top-8 -rotate-12 rounded-lg border-4 border-green-500 px-3 py-1 text-2xl font-extrabold text-green-500"
      >
        LIKE
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="absolute right-5 top-8 rotate-12 rounded-lg border-4 border-red-500 px-3 py-1 text-2xl font-extrabold text-red-500"
      >
        PASS
      </motion.span>
    </motion.div>
  )
}

function AddLiveActivity({ onAdded }: { onAdded: () => void }) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    setBusy(true)
    setError('')
    const { data: live } = await supabase.from('activities').select('id').eq('status', 'live').order('sort_order').limit(1)
    const { error } = live?.[0]
      ? await supabase.from('user_activities').insert({ user_id: profile!.id, activity_id: live[0].id })
      : { error: { message: 'none live' } }
    setBusy(false)
    if (error) return setError(friendlyError(error))
    onAdded()
  }

  return (
    <div className="mt-16 text-center">
      <h1 className="text-xl font-bold text-neutral-900">Garba &amp; Dandiya is live</h1>
      <p className="mt-2 text-neutral-600">The activities you picked are coming soon. Add Garba to start meeting people now.</p>
      <Button className="mt-6" onClick={add} loading={busy}>
        Add Garba &amp; Dandiya
      </Button>
      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  )
}

export default function Discover() {
  const { profile } = useAuth()
  const { refreshBadges } = useShell()
  const uid = profile?.id
  const verified = profile?.verification_status === 'approved'

  const [activity, setActivity] = useState<LiveActivity | null | undefined>(undefined)
  const [queue, setQueue] = useState<FeedProfile[]>([])
  const [viewsLeft, setViewsLeft] = useState<number | null>(null)
  const [mayHaveMore, setMayHaveMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dir, setDir] = useState<Dir>(1)
  const [matchName, setMatchName] = useState<string | null>(null)

  // Swipes are sent in the background; the next feed fetch waits for them so
  // the server never re-serves someone we just swiped.
  const inflight = useRef<PromiseLike<unknown>[]>([])
  const swiped = useRef(new Set<string>())

  const loadActivity = useCallback(() => {
    if (!uid) return
    fetchLiveActivity(uid)
      .then(setActivity)
      .catch((e) => {
        setError(friendlyError(e))
        setLoading(false)
      })
  }, [uid])

  useEffect(loadActivity, [loadActivity])

  const loadFeed = useCallback(async (activityId: string) => {
    setLoading(true)
    await Promise.allSettled(inflight.current)
    inflight.current = []
    const { data, error } = await supabase.rpc('get_feed', { p_activity_id: activityId, p_limit: BATCH })
    setLoading(false)
    if (error) {
      setMayHaveMore(false)
      return setError(friendlyError(error))
    }
    const feed = data as unknown as Feed
    setQueue(feed.profiles.filter((p) => !swiped.current.has(p.id)))
    setViewsLeft(feed.views_left)
    setMayHaveMore(feed.profiles.length === BATCH)
  }, [])

  useEffect(() => {
    if (activity) loadFeed(activity.id)
    else if (activity === null) setLoading(false)
  }, [activity, loadFeed])

  // Fetch the next batch once the deck runs out.
  useEffect(() => {
    if (activity && !loading && queue.length === 0 && mayHaveMore) loadFeed(activity.id)
  }, [activity, loading, queue.length, mayHaveMore, loadFeed])

  const decide = useCallback(
    (d: Dir) => {
      const top = queue[0]
      if (!top || !activity) return
      setError('')
      swiped.current.add(top.id)
      setDir(d)
      setQueue((q) => q.slice(1))

      const args = { p_target_id: top.id, p_activity_id: activity.id }
      const call =
        d === 1
          ? supabase.rpc('like_profile', args).then(({ data, error }) => {
              if (error) return setError(friendlyError(error))
              if ((data as unknown as MatchResult).matched) {
                setMatchName(top.first_name)
                refreshBadges()
              }
            })
          : supabase.rpc('pass_profile', args).then(({ error }) => error && setError(friendlyError(error)))
      inflight.current.push(call)
    },
    [queue, activity, refreshBadges],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (matchName || (e.target as HTMLElement)?.closest('input, textarea')) return
      if (e.key === 'ArrowLeft') decide(-1)
      if (e.key === 'ArrowRight') decide(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, matchName])

  const top = queue[0]
  const next = queue[1]
  const outOfViews = !verified && viewsLeft === 0

  return (
    <>
      {!verified && (
        <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <span className="font-semibold">Pending verification.</span> Your likes will be delivered once you're
          verified — usually within 24 hours.
        </div>
      )}

      {activity === null ? (
        <AddLiveActivity onAdded={loadActivity} />
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-bold text-neutral-900">{activity?.name ?? 'Discover'}</h1>
            {!verified && viewsLeft !== null && (
              <span className="text-xs text-neutral-500">{viewsLeft} new profiles left today</span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            People looking for {SEEKING_OPTIONS.find((o) => o.value === profile?.seeking)?.short ?? 'the same thing'}.{' '}
            <Link to="/profile" className="font-semibold text-brand-700">
              Change
            </Link>
          </p>

          {/* Fills the space between the header and the buttons, so they stay above the tab bar. */}
          <div className="relative mt-3 max-h-[36rem] min-h-72 w-full flex-1">
            {next && <ProfileCard key={next.id} profile={next} photoIndex={0} className="absolute inset-0 h-full w-full scale-95 opacity-80" />}
            <AnimatePresence custom={dir}>
              {top && <SwipeCard key={top.id} profile={top} dir={dir} onDecide={decide} />}
            </AnimatePresence>

            {!top && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-neutral-200 p-6 text-center">
                {loading ? (
                  <Spinner label="Finding people…" />
                ) : outOfViews ? (
                  <>
                    <p className="font-semibold text-neutral-900">That's everyone for today</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Unverified accounts can see a limited number of new profiles a day. Once you're verified, there's no
                      limit.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-neutral-900">You've seen everyone for now</p>
                    <p className="mt-1 text-sm text-neutral-600">New people join every day. Check back later.</p>
                    {activity && (
                      <Button variant="secondary" className="mt-4" onClick={() => loadFeed(activity.id)}>
                        Refresh
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>

          <div className="mt-3 flex justify-center gap-6">
            <button
              type="button"
              onClick={() => decide(-1)}
              disabled={!top}
              aria-label="Pass"
              className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-200 bg-white text-3xl text-red-500 shadow-md transition hover:scale-105 disabled:opacity-40"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => decide(1)}
              disabled={!top}
              aria-label="Like"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-md transition hover:scale-105 disabled:opacity-40"
            >
              ♥
            </button>
          </div>
        </>
      )}

      {matchName && <MatchDialog name={matchName} onClose={() => setMatchName(null)} />}
    </>
  )
}
