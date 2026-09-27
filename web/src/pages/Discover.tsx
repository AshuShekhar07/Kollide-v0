import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { BadgeCheck, Heart, Hourglass, Info, RotateCcw, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AboutView from '../components/AboutView'
import { useShell } from '../components/AppShell'
import DiscoverTabs from '../components/DiscoverTabs'
import MatchDialog from '../components/MatchDialog'
import ProfileCard from '../components/ProfileCard'
import { Sheet } from '../components/SafetyDialogs'
import { Button, EmptyState, ErrorText, Skeleton, Tag } from '../components/ui'
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
        className="absolute left-5 top-10 flex -rotate-12 items-center gap-1.5 rounded-2xl border-[3px] border-green-400 bg-green-500/20 px-3 py-1 font-display text-2xl font-extrabold text-green-300 backdrop-blur-sm"
      >
        <Heart className="h-6 w-6 fill-current" /> LIKE
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="absolute right-5 top-10 flex rotate-12 items-center gap-1.5 rounded-2xl border-[3px] border-red-400 bg-red-500/20 px-3 py-1 font-display text-2xl font-extrabold text-red-300 backdrop-blur-sm"
      >
        <X className="h-6 w-6" strokeWidth={3} /> PASS
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
    <>
      <EmptyState
        icon={Sparkles}
        title="Garba & Dandiya is live"
        action={
          <Button onClick={add} loading={busy}>
            Add Garba &amp; Dandiya
          </Button>
        }
      >
        The activities you picked are coming soon. Add Garba to start meeting people now.
      </EmptyState>
      <ErrorText>{error}</ErrorText>
    </>
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
  const [matchName, setMatchName] = useState<{ name: string; photo: string | null } | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)

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
                setMatchName({ name: top.first_name, photo: top.photo_paths[0] ?? null })
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
      if (matchName || aboutOpen || (e.target as HTMLElement)?.closest('input, textarea')) return
      if (e.key === 'ArrowLeft') decide(-1)
      if (e.key === 'ArrowRight') decide(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, matchName, aboutOpen])

  const top = queue[0]
  const next = queue[1]
  const outOfViews = !verified && viewsLeft === 0

  const seeking = SEEKING_OPTIONS.find((o) => o.value === profile?.seeking)?.short ?? 'the same thing'

  return (
    <>
      <DiscoverTabs />
      {!verified && (
        <div className="mb-3 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Verification pending.</span> Your likes are delivered once you're verified,
            usually within 24 hours.
          </p>
        </div>
      )}

      {activity === null ? (
        <AddLiveActivity onAdded={loadActivity} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-neutral-900">{activity?.name ?? 'Discover'}</h1>
              <Link to="/profile" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                Looking for {seeking}
                <span className="font-semibold text-brand-700">· Change</span>
              </Link>
            </div>
            {!verified && viewsLeft !== null && (
              <Tag tone="amber" className="shrink-0">
                {viewsLeft} left today
              </Tag>
            )}
          </div>

          {/* Fills the space between the header and the buttons, so they stay above the tab bar. */}
          <div className="relative mt-3 max-h-[36rem] min-h-80 w-full flex-1">
            {next && (
              <ProfileCard
                key={next.id}
                profile={next}
                photoIndex={0}
                className="absolute inset-0 h-full w-full translate-y-2 scale-[0.94] opacity-70"
              />
            )}
            <AnimatePresence custom={dir}>
              {top && <SwipeCard key={top.id} profile={top} dir={dir} onDecide={decide} />}
            </AnimatePresence>

            {!top &&
              (loading ? (
                <div className="absolute inset-0 overflow-hidden rounded-[2rem]" role="status" aria-label="Finding people">
                  <Skeleton className="h-full w-full !rounded-[2rem]" />
                  <div className="absolute inset-x-5 bottom-6 space-y-2">
                    <Skeleton className="h-7 w-40 !bg-neutral-300/60" />
                    <Skeleton className="h-4 w-56 !bg-neutral-300/60" />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center overflow-y-auto rounded-[2rem] border border-neutral-200 bg-surface">
                  {outOfViews ? (
                    <EmptyState icon={Hourglass} title="That's everyone for today">
                      Unverified accounts see a limited number of new profiles a day. Once you're verified, there's no
                      limit.
                    </EmptyState>
                  ) : (
                    <EmptyState
                      icon={Sparkles}
                      title="You've seen everyone for now"
                      action={
                        activity && (
                          <div className="flex flex-col items-center gap-2">
                            <Button variant="secondary" onClick={() => loadFeed(activity.id)}>
                              <RotateCcw className="h-4 w-4" /> Refresh
                            </Button>
                            <Link to="/groups" className="text-sm font-semibold text-brand-700">
                              Or browse groups →
                            </Link>
                          </div>
                        )
                      }
                    >
                      New people join every day. Check back soon.
                    </EmptyState>
                  )}
                </div>
              ))}
          </div>

          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>

          <div className="mt-3 flex items-center justify-center gap-5">
            <ActionButton label="Pass" onClick={() => decide(-1)} disabled={!top} className="h-16 w-16 border border-neutral-200 bg-surface text-red-500">
              <X className="h-8 w-8" strokeWidth={2.6} />
            </ActionButton>
            <ActionButton
              label={top ? `About ${top.first_name}` : 'About'}
              onClick={() => setAboutOpen(true)}
              disabled={!top}
              className="h-12 w-12 border border-neutral-200 bg-surface text-brand-700"
            >
              <Info className="h-5 w-5" strokeWidth={2.4} />
            </ActionButton>
            <ActionButton
              label="Like"
              onClick={() => decide(1)}
              disabled={!top}
              className="h-16 w-16 bg-gradient-to-br from-plum-500 to-plum-700 text-white shadow-plum-600/40"
            >
              <Heart className="h-8 w-8 fill-current" />
            </ActionButton>
          </div>
        </>
      )}

      {aboutOpen && top && (
        <Sheet label={`About ${top.first_name}`} onClose={() => setAboutOpen(false)}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-neutral-900">
              {top.first_name}, {top.age}
            </h2>
            <Tag tone="brand">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </Tag>
          </div>
          <AboutView userId={top.id} bio={top.bio} />
          <div className="mt-5 flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setAboutOpen(false)
                decide(-1)
              }}
            >
              <X className="h-4 w-4" /> Pass
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setAboutOpen(false)
                decide(1)
              }}
            >
              <Heart className="h-4 w-4 fill-current" /> Like
            </Button>
          </div>
        </Sheet>
      )}
      {matchName && <MatchDialog name={matchName.name} photoPath={matchName.photo} onClose={() => setMatchName(null)} />}
    </>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  className: string
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={{ scale: 0.86 }}
      whileHover={{ scale: 1.06 }}
      className={`flex items-center justify-center rounded-full shadow-lg shadow-black/10 transition-opacity disabled:opacity-40 ${className}`}
    >
      {children}
    </motion.button>
  )
}
