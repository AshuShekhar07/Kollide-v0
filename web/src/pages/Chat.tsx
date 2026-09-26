import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSignedPhotos } from '../components/ProfileCard'
import { BlockDialog, ReportDialog } from '../components/SafetyDialogs'
import SocialLinks from '../components/SocialLinks'
import { Button, ErrorText, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { MAX_MESSAGE_LENGTH, PRIVACY_COPY, type ChatMessage, type Conversation } from '../lib/chat'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

const PAGE = 50

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

function Avatar({ path }: { path: string | null }) {
  const [url] = useSignedPhotos(path ? [path] : [])
  return (
    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-200">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </span>
  )
}

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
  const [dialog, setDialog] = useState<'report' | 'block' | 'socials' | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  // Latest header, for the Realtime handlers.
  const convRef = useRef<Conversation | null>(null)
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

  // New messages and count/frozen changes. RLS limits both to members, and
  // hides messages from anyone the reader has blocked.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as ChatMessage
          const el = listRef.current
          const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
          if (nearBottom || m.sender_id === uid) scrollMode.current = { kind: 'bottom' }
          setMessages((cur) => merge(cur, [m]))
          if (m.sender_id !== uid) markRead()
          // Someone new in the group (e.g. rejoined); fetch their name.
          const names = convRef.current?.group?.names
          if (names && m.sender_id && !names[m.sender_id]) loadConversation()
        },
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
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, uid, markRead, loadConversation])

  useEffect(() => {
    convRef.current = conv
  }, [conv])

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

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  if (loadError && !conv) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <Link to="/matches" className="text-sm font-semibold text-brand-700">
          ← Matches
        </Link>
        <div className="mt-6">
          <ErrorText>{loadError}</ErrorText>
        </div>
      </main>
    )
  }
  if (!conv) return <Spinner />

  const group = conv.kind === 'group' ? conv.group : null
  const other = group ? null : (conv.members[0] ?? null)
  const remaining = Math.max(conv.message_cap - conv.message_count, 0)
  const used = conv.message_count / conv.message_cap
  const atCap = remaining === 0
  const closed = conv.is_frozen || (!group && !other)
  // Report and block for group members live on the group page.
  const target = other && { userId: other.user_id, name: other.first_name }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-3 py-2">
        <Link to="/matches" className="px-1 text-xl text-brand-700" aria-label="Back to matches">
          ←
        </Link>
        {group ? (
          <Link to={`/groups/${group.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
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
            <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-brand-700">Info</span>
          </Link>
        ) : other ? (
          <>
            <Avatar path={other.photo_path} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-neutral-900">{other.first_name}</p>
              <p className="font-mono text-xs text-neutral-500">{other.public_code}</p>
            </div>
          </>
        ) : (
          <p className="flex-1 font-semibold text-neutral-500">Chat closed</p>
        )}
        {target && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-full px-3 py-1 text-xl leading-none text-neutral-600 hover:bg-neutral-100"
              aria-label="Chat options"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
            {menuOpen && (
              <ul className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1 text-sm shadow-lg">
                {[
                  { key: 'socials', label: `${other.first_name}'s socials`, className: 'text-neutral-800' },
                  { key: 'report', label: 'Report', className: 'text-red-700' },
                  { key: 'block', label: 'Block', className: 'text-red-700' },
                ].map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setDialog(item.key as 'socials' | 'report' | 'block')
                      }}
                      className={`w-full px-4 py-2.5 text-left font-medium hover:bg-neutral-50 ${item.className}`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      <div className="border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs text-brand-900">
        <div className="flex items-start justify-between gap-3">
          <p>
            You share <strong>{conv.message_cap} messages</strong> in this chat, then continue on socials.
          </p>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-semibold text-brand-700" aria-live="polite">
            {remaining} left
          </span>
        </div>
        <p className="mt-1 text-brand-700">{PRIVACY_COPY}</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3">
        {hasMore && (
          <div className="mb-3 text-center">
            <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={loadOlder} loading={loadingOlder}>
              Load earlier messages
            </Button>
          </div>
        )}
        {messages.length === 0 && !closed && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            Say hi{group ? ' to the group' : other ? ` to ${other.first_name}` : ''}! Plan where you'll meet for Garba.
          </p>
        )}
        <ul className="space-y-1.5">
          {messages.map((m, i) => {
            const mine = m.sender_id === uid
            const showName = group && !mine && messages[i - 1]?.sender_id !== m.sender_id
            return (
              <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {showName && (
                  <span className="mb-0.5 ml-2 mt-1 text-xs font-semibold text-neutral-500">
                    {(m.sender_id && group.names[m.sender_id]) || 'Former member'}
                  </span>
                )}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] ${
                    mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-neutral-100 text-neutral-900'
                  }`}
                >
                  {m.body}
                  <span className={`ml-2 inline-block text-[10px] ${mine ? 'text-white/70' : 'text-neutral-400'}`}>
                    {time(m.created_at)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-neutral-200 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {closed ? (
          <p className="rounded-2xl bg-neutral-100 px-4 py-3 text-center text-sm text-neutral-600">
            {group ? 'This group has closed.' : 'This chat is closed.'}
          </p>
        ) : atCap ? (
          <div className="max-h-[50dvh] overflow-y-auto rounded-2xl border border-marigold-500/40 bg-marigold-500/10 p-4">
            <p className="font-bold text-neutral-900">You've used all {conv.message_cap} messages</p>
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
                className={`mb-2 rounded-xl px-3 py-2 text-xs font-medium ${
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
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setSendError('')
                }}
                onKeyDown={onKeyDown}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={1}
                placeholder="Message"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-neutral-300 px-4 py-2.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <Button type="submit" className="h-11 px-4" loading={sending} disabled={!draft.trim()}>
                Send
              </Button>
            </form>
            {draft.length > MAX_MESSAGE_LENGTH - 100 && (
              <p className="mt-1 text-right text-xs text-neutral-500">
                {draft.length}/{MAX_MESSAGE_LENGTH}
              </p>
            )}
          </>
        )}
      </div>

      {dialog === 'socials' && other && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${other.first_name}'s socials`}
          onClick={(e) => e.target === e.currentTarget && setDialog(null)}
        >
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <h2 className="mb-3 text-lg font-bold text-neutral-900">{other.first_name}'s socials</h2>
            <SocialLinks userId={other.user_id} />
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setDialog(null)}>
              Close
            </Button>
          </div>
        </div>
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
