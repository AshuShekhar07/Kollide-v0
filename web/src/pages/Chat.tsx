import { ArrowLeft, AtSign, Ban, Flag, Info, Lock, MoreVertical, PartyPopper, SendHorizontal, Share2, UsersRound } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useShell } from '../components/AppShell'
import Avatar from '../components/Avatar'
import { BlockDialog, ReportDialog, Sheet } from '../components/SafetyDialogs'
import ShareMatch from '../components/ShareMatch'
import SocialLinks from '../components/SocialLinks'
import { Button, ErrorText, FullScreenSpinner } from '../components/ui'
import { festiveTile } from '../lib/festive'
import { useAuth } from '../lib/auth-context'
import { MAX_MESSAGE_LENGTH, PRIVACY_COPY, type ChatMessage, type Conversation } from '../lib/chat'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

const PAGE = 50
// Fallback when Realtime isn't connected: how long to wait for it before
// polling, and how often to poll.
const CHAT_SUBSCRIBE_TIMEOUT_MS = 10_000
const CHAT_POLL_MS = 5_000

// Ascending by time, no duplicates (a sent message can arrive both from the
// RPC result and from Realtime).
function merge(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

const ICEBREAKERS = [
  'Which Garba night are you going to? 💃',
  'Where do you usually go for Garba in your city?',
  'Honest question: how good are your Garba steps? 😄',
]

export default function Chat() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const uid = profile?.id

  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<'report' | 'block' | 'socials' | 'share' | null>(null)
  const myPhoto = useShell()?.myPhoto ?? null

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Latest header and messages, for the Realtime and polling handlers.
  const convRef = useRef<Conversation | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  // How to fix up the scroll position after the next render of `messages`.
  const scrollMode = useRef<{ kind: 'bottom' } | { kind: 'keep'; fromBottom: number } | null>({ kind: 'bottom' })

  const markRead = useCallback(() => {
    supabase.rpc('mark_conversation_read', { p_conversation_id: id }).then(() => {})
  }, [id])

  const loadConversation = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_conversation', { p_conversation_id: id })
    if (error) return setLoadError(friendlyError(error))
    setConv(data as unknown as Conversation)
  }, [id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadConversation()
      const { data, error } = await supabase.rpc('get_messages', { p_conversation_id: id, p_limit: PAGE })
      if (cancelled) return
      if (error) return setLoadError(friendlyError(error))
      scrollMode.current = { kind: 'bottom' }
      setMessages((cur) => merge(cur, data))
      setHasMore(data.length === PAGE)
      markRead()
    })()
    return () => {
      cancelled = true
    }
  }, [id, loadConversation, markRead])

  // Messages that arrive live or by polling; ones already on screen (our own
  // send, or the same message from both paths) are skipped.
  const receive = useCallback(
    (incoming: ChatMessage[]) => {
      const fresh = incoming.filter((m) => !messagesRef.current.some((x) => x.id === m.id))
      if (fresh.length === 0) return
      const el = listRef.current
      const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
      if (nearBottom || fresh.some((m) => m.sender_id === uid)) scrollMode.current = { kind: 'bottom' }
      setMessages((cur) => merge(cur, fresh))
      if (fresh.some((m) => m.sender_id !== uid)) markRead()
      // Someone new in the group (e.g. rejoined); fetch their name.
      const names = convRef.current?.group?.names
      if (names && fresh.some((m) => m.sender_id && !names[m.sender_id])) loadConversation()
    },
    [uid, markRead, loadConversation],
  )

  // New messages and count/frozen changes. RLS limits both to members, and
  // hides messages from anyone the reader has blocked. If the socket can't
  // connect, drops, or errors, poll until it is back: Realtime is only the
  // fast path.
  useEffect(() => {
    let stopped = false
    let down = false
    let polling = false
    let pollTimer: number | undefined
    let connectTimer: number | undefined

    const poll = async () => {
      if (polling) return
      polling = true
      const [latest] = await Promise.all([
        supabase.rpc('get_messages', { p_conversation_id: id, p_limit: PAGE }),
        loadConversation(),
      ])
      polling = false
      if (stopped || latest.error) return
      receive([...latest.data].reverse())
    }
    const startPolling = () => {
      if (stopped || pollTimer !== undefined) return
      down = true
      poll()
      pollTimer = window.setInterval(poll, CHAT_POLL_MS)
    }
    const stopPolling = () => {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }

    connectTimer = window.setTimeout(startPolling, CHAT_SUBSCRIBE_TIMEOUT_MS)
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => receive([payload.new as ChatMessage]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as Pick<Conversation, 'message_count' | 'message_cap' | 'is_frozen'>
          setConv((cur) => cur && { ...cur, message_count: next.message_count, message_cap: next.message_cap, is_frozen: next.is_frozen })
          // A block or ban hides the other member, and a bigger cap means
          // someone joined the group; refetch the header for either.
          const cur = convRef.current
          if (next.is_frozen || (cur && next.message_cap !== cur.message_cap)) loadConversation()
        },
      )
      .subscribe((status) => {
        if (stopped) return
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(connectTimer)
          // Back after a gap: stop polling and fetch what was missed once.
          if (down) {
            down = false
            stopPolling()
            poll()
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(connectTimer)
          startPolling()
        }
      })
    return () => {
      // Before removeChannel, which itself reports CLOSED.
      stopped = true
      window.clearTimeout(connectTimer)
      stopPolling()
      supabase.removeChannel(channel)
    }
  }, [id, receive, loadConversation])

  useEffect(() => {
    convRef.current = conv
  }, [conv])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useLayoutEffect(() => {
    const el = listRef.current
    const mode = scrollMode.current
    if (!el || !mode) return
    el.scrollTop = mode.kind === 'bottom' ? el.scrollHeight : el.scrollHeight - mode.fromBottom
    scrollMode.current = null
  }, [messages])

  async function loadOlder() {
    const oldest = messages[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    const { data, error } = await supabase.rpc('get_messages', {
      p_conversation_id: id,
      p_before: oldest.created_at,
      p_limit: PAGE,
    })
    setLoadingOlder(false)
    if (error) return setLoadError(friendlyError(error))
    const el = listRef.current
    scrollMode.current = { kind: 'keep', fromBottom: el ? el.scrollHeight - el.scrollTop : 0 }
    setMessages((cur) => merge(cur, data))
    setHasMore(data.length === PAGE)
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setSendError('')
    const { data, error } = await supabase.rpc('send_message', { p_conversation_id: id, p_body: body })
    setSending(false)
    if (error) {
      if (error.code === 'KL002') setConv((c) => c && { ...c, message_count: c.message_cap })
      else if (/closed/i.test(error.message)) loadConversation()
      return setSendError(friendlyError(error))
    }
    const result = data as unknown as { message: ChatMessage; remaining: number }
    scrollMode.current = { kind: 'bottom' }
    setMessages((cur) => merge(cur, [result.message]))
    setConv((c) => c && { ...c, message_count: c.message_cap - result.remaining })
    setDraft('')
  }

  // Grow the box with its text, up to its max height; past that it scrolls.
  // The message list keeps its place from the bottom as the box grows.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    const list = listRef.current
    const fromBottom = list ? list.scrollHeight - list.scrollTop - list.clientHeight : 0
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
    if (list) list.scrollTop = list.scrollHeight - list.clientHeight - fromBottom
  }, [draft])

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  if (loadError && !conv) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6 lg:max-w-4xl lg:pt-10">
        <Link to="/matches" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Chats
        </Link>
        <div className="mt-6">
          <ErrorText>{loadError}</ErrorText>
        </div>
      </main>
    )
  }
  if (!conv) return <FullScreenSpinner />

  const group = conv.kind === 'group' ? conv.group : null
  const other = group ? null : (conv.members[0] ?? null)
  const remaining = Math.max(conv.message_cap - conv.message_count, 0)
  const used = conv.message_count / conv.message_cap
  const atCap = remaining === 0
  const closed = conv.is_frozen || (!group && !other)
  // Report and block for group members live on the group page.
  const target = other && { userId: other.user_id, name: other.first_name }
  const meterTone = used >= 0.95 ? 'bg-red-500' : used >= 0.8 ? 'bg-marigold-500' : 'bg-neutral-900'

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-canvas md:max-w-2xl lg:h-[calc(100dvh-4.75rem)] lg:max-w-4xl lg:border-x lg:border-neutral-200">
      <header className="z-20 flex items-center gap-2 border-b border-neutral-200/70 bg-surface/90 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-xl lg:px-4 lg:py-3">
        <Link
          to="/matches"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {group ? (
          <Link to={`/groups/${group.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pr-2 hover:bg-neutral-100">
            <span className={`bandhani-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] font-display font-extrabold ${festiveTile(group.id)}`}>
              {group.title.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-neutral-900">{group.title}</span>
              <span className="block truncate text-xs text-neutral-500">
                {conv.members.length === 0
                  ? 'Just you so far'
                  : `You, ${conv.members.map((m) => m.first_name).join(', ')}`}
              </span>
            </span>
            <Info className="h-5 w-5 shrink-0 text-neutral-400" aria-label="Group info" />
          </Link>
        ) : other ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar path={other.photo_path} name={other.first_name} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-neutral-900">{other.first_name}</p>
            </div>
          </div>
        ) : (
          <p className="flex-1 font-semibold text-neutral-500">Chat closed</p>
        )}
        {target && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
              aria-label="Chat options"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <ul className="absolute right-0 top-11 z-30 w-52 origin-top-right animate-pop overflow-hidden rounded-2xl border border-neutral-200 bg-surface py-1.5 text-sm shadow-xl">
                  {[
                    { key: 'share', label: 'Share our match', icon: Share2, className: 'text-neutral-800' },
                    { key: 'socials', label: `${other.first_name}'s socials`, icon: AtSign, className: 'text-neutral-800' },
                    { key: 'report', label: 'Report', icon: Flag, className: 'text-red-700' },
                    { key: 'block', label: 'Block', icon: Ban, className: 'text-red-700' },
                  ].map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setDialog(item.key as 'share' | 'socials' | 'report' | 'block')
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-neutral-50 ${item.className}`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </header>

      {!closed && (
        <div className="border-b border-neutral-200/70 bg-surface/60 px-4 py-2 lg:px-8">
          <p className="text-xs text-neutral-600" aria-live="polite">
            <strong className="font-semibold text-neutral-900">{remaining}</strong> of {conv.message_cap} shared messages left,
            then continue on socials.
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
            <div className={`h-full rounded-full transition-all duration-500 ${meterTone}`} style={{ width: `${Math.min(used, 1) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex gap-1.5 text-[11px] leading-snug text-neutral-500">
            <Lock className="mt-px h-3 w-3 shrink-0" /> {PRIVACY_COPY}
          </p>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 lg:px-8 lg:py-6">
        {hasMore && (
          <div className="mb-3 text-center">
            <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={loadOlder} loading={loadingOlder}>
              Load earlier messages
            </Button>
          </div>
        )}
        {messages.length === 0 && !closed && (
          <div className="flex animate-rise flex-col items-center px-4 pt-8 text-center">
            {other ? (
              <Avatar path={other.photo_path} name={other.first_name} className="h-20 w-20 text-2xl" ring />
            ) : (
              <span className="bandhani-soft flex h-20 w-20 -rotate-6 items-center justify-center rounded-[1.6rem] bg-maroon-700 text-cream shadow-xl shadow-maroon-950/20">
                <UsersRound className="h-9 w-9" />
              </span>
            )}
            <p className="mt-5 font-display text-2xl font-extrabold tracking-[-0.03em] text-neutral-900">
              Say hi{group ? ' to the group' : other ? ` to ${other.first_name}` : ''} 👋
            </p>
            <p className="mt-1 text-sm text-neutral-500">Plan where you'll meet for Garba. Tap one to start:</p>
            <div className="mt-4 flex w-full max-w-md flex-col gap-2">
              {ICEBREAKERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDraft(t)
                    inputRef.current?.focus()
                  }}
                  className="rounded-2xl border border-neutral-200 bg-surface px-4 py-3 text-left text-sm font-semibold text-neutral-800 transition hover:-translate-y-0.5 hover:border-brand-500 active:scale-[0.98]"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <ul aria-label="Conversation">
          {messages.map((m, i) => {
            const mine = m.sender_id === uid
            const prev = messages[i - 1]
            const nextMsg = messages[i + 1]
            const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
            const firstOfRun = newDay || prev?.sender_id !== m.sender_id
            const lastOfRun = !nextMsg || nextMsg.sender_id !== m.sender_id || dayLabel(nextMsg.created_at) !== dayLabel(m.created_at)
            const showName = group && !mine && firstOfRun
            const corner = mine ? (lastOfRun ? 'rounded-br-md' : '') : lastOfRun ? 'rounded-bl-md' : ''
            return (
              <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${firstOfRun ? 'mt-3' : 'mt-0.5'}`}>
                {newDay && (
                  <span className="mx-auto mb-3 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-500">
                    {dayLabel(m.created_at)}
                  </span>
                )}
                {showName && (
                  <span className="mb-1 ml-3 text-xs font-bold text-brand-600">
                    {(m.sender_id && group.names[m.sender_id]) || 'Former member'}
                  </span>
                )}
                <div
                  className={`max-w-[80%] lg:max-w-[60%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-snug ${corner} ${
                    mine
                      ? 'bg-ink text-on-ink'
                      : 'border border-neutral-200/80 bg-surface text-neutral-900 shadow-sm'
                  }`}
                >
                  {m.body}
                  <span className={`ml-2 inline-block translate-y-0.5 text-[10px] ${mine ? 'text-on-ink/60' : 'text-neutral-400'}`}>
                    {time(m.created_at)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-neutral-200/70 bg-surface/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:px-8 lg:pb-5 lg:pt-4">
        {closed ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-neutral-100 px-4 py-3 text-center text-sm text-neutral-600">
            <Lock className="h-4 w-4" />
            {group ? 'This group has closed.' : 'This chat is closed.'}
          </p>
        ) : atCap ? (
          <div className="max-h-[50dvh] overflow-y-auto rounded-3xl border border-marigold-300 bg-marigold-50 p-4">
            <p className="flex items-center gap-2 font-display font-bold text-neutral-900">
              <PartyPopper className="h-5 w-5 text-marigold-600" /> You've used all {conv.message_cap} messages
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Continue on socials with {group ? 'the group' : other?.first_name}.
            </p>
            {group ? (
              <div className="mt-3 space-y-3">
                {conv.members.map((m) => (
                  <div key={m.user_id}>
                    <p className="mb-1 text-sm font-semibold text-neutral-800">{m.first_name}</p>
                    <SocialLinks userId={m.user_id} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3">{other && <SocialLinks userId={other.user_id} />}</div>
            )}
          </div>
        ) : (
          <>
            {used >= 0.8 && (
              <p
                className={`mb-2 rounded-2xl px-3 py-2 text-xs font-medium ${
                  used >= 0.95 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                }`}
                role="status"
              >
                {used >= 0.95
                  ? `Only ${remaining} message${remaining === 1 ? '' : 's'} left. Swap socials now so you don't lose touch.`
                  : `You've used ${Math.floor(used * 100)}% of this chat's messages. Good time to swap socials.`}
              </p>
            )}
            {sendError && (
              <div className="mb-2">
                <ErrorText>{sendError}</ErrorText>
              </div>
            )}
            <form onSubmit={send} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="chat-input">
                Message
              </label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setSendError('')
                }}
                onKeyDown={onKeyDown}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={1}
                placeholder="Message"
                className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.85 }}
                disabled={!draft.trim() || sending}
                aria-label="Send"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rani text-white shadow-lg shadow-rani/30 transition disabled:opacity-40"
              >
                {sending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <SendHorizontal className="h-5 w-5" />
                )}
              </motion.button>
            </form>
            {draft.length > MAX_MESSAGE_LENGTH - 100 && (
              <p className="mt-1 text-right text-xs text-neutral-500">
                {draft.length}/{MAX_MESSAGE_LENGTH}
              </p>
            )}
          </>
        )}
      </div>

      {dialog === 'share' && other && (
        <ShareMatch
          them={{ id: other.user_id, name: other.first_name, photoPath: other.photo_path }}
          myPhotoPath={myPhoto}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'socials' && other && (
        <Sheet label={`${other.first_name}'s socials`} onClose={() => setDialog(null)}>
          <h2 className="mb-3 text-xl font-bold text-neutral-900">{other.first_name}'s socials</h2>
          <SocialLinks userId={other.user_id} />
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setDialog(null)}>
            Close
          </Button>
        </Sheet>
      )}
      {dialog === 'report' && target && (
        <ReportDialog
          target={target}
          conversationId={conv.id}
          onClose={() => setDialog(null)}
          onReported={() => navigate('/matches', { replace: true })}
        />
      )}
      {dialog === 'block' && target && (
        <BlockDialog
          target={target}
          onClose={() => setDialog(null)}
          onBlocked={() => navigate('/matches', { replace: true })}
          onReportInstead={() => setDialog('report')}
        />
      )}
    </div>
  )
}
