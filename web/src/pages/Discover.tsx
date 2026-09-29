import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { BadgeCheck, Heart, Hourglass, RotateCcw, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AboutView from '../components/AboutView'
import { useShell } from '../components/AppShell'
import DiscoverTabs from '../components/DiscoverTabs'
import MatchDialog from '../components/MatchDialog'
import ProfileCard from '../components/ProfileCard'
import ProfileStack from '../components/ProfileStack'
import { Button, EmptyState, ErrorText, Eyebrow, Skeleton, Tag } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { fetchLiveActivity, type Feed, type FeedProfile, type LiveActivity, type MatchResult } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { signedThumbUrls } from '../lib/photos'
import { SEEKING_OPTIONS } from '../lib/profile-options'
import { supabase } from '../lib/supabase'
import { useIsDesktop } from '../lib/useIsDesktop'

const BATCH = 20
const SWIPE_PX = 110
const SWIPE_VELOCITY = 600

type Dir = -1 | 1 // pass | like

const exitVariants = {
  exit: (d: Dir) => ({ x: d * 600, rotate: d * 20, opacity: 0, transition: { duration: 0.3 } }),
}

// Phones: the card is the whole profile, scrolled up and down, and swiped
// left or right. Desktop: a photo card (click for the next photo), with the
// profile in the column beside it.
function SwipeCard({ profile, dir, onDecide }: { profile: FeedProfile; dir: Dir; onDecide: (d: Dir) => void }) {
  const desktop = useIsDesktop()
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

  // Desktop: click the left/right half to step through photos (taps don't
  // fire after a drag).
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
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      onTap={desktop ? onTap : undefined}
      custom={dir}
      variants={exitVariants}
      exit="exit"
    >
      {desktop ? (
        <ProfileCard profile={profile} photoIndex={photo} className="h-full w-full" hideBio />
      ) : (
        <ProfileStack
          profile={profile}
          userId={profile.id}
          size="thumb"
          peek
          className="h-full touch-pan-y overflow-y-auto overscroll-contain rounded-[2rem] bg-surface p-2 shadow-xl shadow-maroon-950/15 ring-1 ring-neutral-200/80 [scrollbar-width:none]"
          heroClassName="h-[calc(100%-6.5rem)]"
          end={
            <p className="px-4 pb-28 pt-2 text-center text-xs font-semibold text-neutral-500">
              Swipe right to like {profile.first_name}, left to pass.
            </p>
          }
        />
      )}
      {/* The buttons float over this fade, and the profile scrolls up under them. */}
      {!desktop && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 rounded-b-[2rem] bg-gradient-to-t from-surface via-surface/85 to-transparent" />
      )}
      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-5 top-10 flex -rotate-12 items-center gap-1.5 rounded-2xl border-[3px] border-marigold-400 bg-rani/80 px-3 py-1 font-display text-2xl font-extrabold text-white shadow-lg backdrop-blur-sm"
      >
        <Heart className="h-6 w-6 fill-current" /> LIKE
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="pointer-events-none absolute right-5 top-10 flex rotate-12 items-center gap-1.5 rounded-2xl border-[3px] border-white bg-maroon-950/70 px-3 py-1 font-display text-2xl font-extrabold text-white shadow-lg backdrop-blur-sm"
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
    // Sign every profile's first photo once, in one request; the cards find
    // the URLs cached (or share this request) instead of signing again.
    void signedThumbUrls(feed.profiles.map((p) => p.photo_paths[0]).filter(Boolean))
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
          <div className="flex items-end justify-between gap-3">
            {/* Phones keep this to one line so the card gets the room. */}
            <div className="min-w-0">
              <Link
                to="/profile"
                className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-neutral-500 lg:text-[11px] lg:font-bold lg:uppercase lg:tracking-[0.2em] lg:text-brand-500"
              >
                <span className="font-bold text-brand-500 lg:hidden">{activity?.name ?? 'Discover'} ·</span>
                <span className="truncate">Looking for {seeking}</span>
                <span className="shrink-0 font-bold text-neutral-900 lg:text-neutral-400">· Change</span>
              </Link>
              <h1 className="mt-1 hidden truncate font-extrabold leading-none tracking-[-0.04em] text-neutral-900 lg:block lg:text-5xl">
                {activity?.name ?? 'Discover'}
              </h1>
            </div>
            {!verified && viewsLeft !== null && (
              <Tag tone="amber" className="shrink-0">
                {viewsLeft} left today
              </Tag>
            )}
          </div>

          {/* Phones: the card runs down to just above the tab bar, with the buttons
              floating over its bottom edge. Desktop: card on the left, profile on the right. */}
          <div className="-mb-6 mt-3 flex flex-1 flex-col lg:mb-0 lg:mt-6 lg:grid lg:flex-none lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start lg:gap-12">
            <div className="flex flex-1 flex-col">
              <div className="relative mt-1 min-h-96 w-full flex-1 lg:mt-0 lg:h-[min(40rem,calc(100dvh-25rem))] lg:min-h-[26rem] lg:max-h-none lg:flex-none">
                {next && (
                  <ProfileCard
                    key={next.id}
                    profile={next}
                    photoIndex={0}
                    className="absolute inset-0 h-full w-full translate-y-3 rotate-2 scale-[0.93] opacity-60"
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
                    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto rounded-[2rem] border border-neutral-200/80 bg-surface">
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
              <div className="pointer-events-none relative z-20 -mt-[5.5rem] flex items-center justify-center gap-6 pb-4 lg:mt-5 lg:pb-0 [&>*]:pointer-events-auto">
                <ActionButton
                  label="Pass"
                  onClick={() => decide(-1)}
                  disabled={!top}
                  className="h-16 w-16 bg-surface text-neutral-900 shadow-maroon-950/20 ring-1 ring-neutral-200"
                >
                  <X className="h-8 w-8" strokeWidth={2.6} />
                </ActionButton>
                <ActionButton
                  label="Like"
                  onClick={() => decide(1)}
                  disabled={!top}
                  className="h-[4.5rem] w-[4.5rem] bg-rani text-white shadow-rani/35 ring-4 ring-marigold-400/60"
                >
                  <Heart className="h-9 w-9 fill-current" />
                </ActionButton>
              </div>
              {error && (
                <div className="mt-2">
                  <ErrorText>{error}</ErrorText>
                </div>
              )}
            </div>

            <aside className="hidden lg:block" aria-label={top ? `About ${top.first_name}` : undefined}>
              {top ? (
                <div key={top.id} className="animate-rise">
                  <Eyebrow>Up next</Eyebrow>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h2 className="text-5xl font-extrabold leading-none tracking-[-0.04em] text-neutral-900">
                      {top.first_name}, {top.age}
                    </h2>
                    <Tag tone="haldi">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </Tag>
                  </div>
                  <div className="mt-6 max-w-xl">
                    <AboutView userId={top.id} bio={top.bio} />
                  </div>
                  <p className="mt-8 flex items-center gap-2 text-xs text-neutral-500">
                    <kbd className="rounded-md border border-neutral-200 px-1.5 py-0.5 font-mono">←</kbd> pass
                    <kbd className="ml-2 rounded-md border border-neutral-200 px-1.5 py-0.5 font-mono">→</kbd> like
                    <span className="ml-2">· click the photo to see more</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-[28px] border-2 border-dashed border-neutral-200 p-8 text-sm leading-relaxed text-neutral-500">
                  Profiles show up here with everything they've shared: what they're into, the nights they're going,
                  and a bit about them.
                </div>
              )}
            </aside>
          </div>
        </>
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
