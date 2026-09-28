import { Ban, Lock, MapPin, MessageCircle, ShieldCheck, UsersRound, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { PRIVACY_COPY } from '../../lib/chat'
import { G } from './garba'
import { FadeUp, RevealText } from './Reveal'

type Tile = {
  icon: LucideIcon
  stat?: string
  title: string
  body: string
  bg: string
  fg: string
  span: string
  outline?: boolean
}

const TILES: Tile[] = [
  {
    icon: ShieldCheck,
    stat: '24h',
    title: 'Every profile is checked by a person',
    body: "Record a 10-second face video and our team compares it with your photos, usually within 24 hours. No bots, no catfish. Until you're approved you can still browse and like; your likes are held and delivered once you're in.",
    bg: G.maroon,
    fg: G.cream,
    span: 'md:col-span-4',
  },
  {
    icon: UsersRound,
    stat: '2-10',
    title: 'Go as two, or as ten',
    body: 'Match one-on-one, or join a group of 2 to 10 heading to the same night. Start your own and share the invite link.',
    bg: G.marigold,
    fg: G.ink,
    span: 'md:col-span-2',
  },
  {
    icon: MessageCircle,
    stat: '100',
    title: 'Messages, then socials',
    body: 'A one-on-one chat has 100 shared messages, text only. Enough to plan the night; then carry on over Instagram, WhatsApp, Snapchat or Telegram.',
    bg: G.peacock,
    fg: G.cream,
    span: 'md:col-span-2',
  },
  {
    icon: Ban,
    title: 'Block in one tap',
    body: "Blocking is instant and they're never told. Reports go straight to our safety team, and for anything serious you'll see the cybercrime helpline, 1930.",
    bg: G.cream,
    fg: G.ink,
    span: 'md:col-span-2',
    outline: true,
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: `${PRIVACY_COPY} Your socials are shown only to people you match with.`,
    bg: G.rani,
    fg: G.cream,
    span: 'md:col-span-2',
  },
  {
    icon: MapPin,
    title: 'Bangalore only, 18+',
    body: "We're starting in one city so every garba night has people on it. Everyone on Kollide is an adult.",
    bg: G.haldi,
    fg: G.ink,
    span: 'md:col-span-6 lg:col-span-6',
  },
]

/** What you actually get: verification, groups, chat and safety, as a bento. */
export default function Details() {
  return (
    <section className="px-5 py-24 sm:px-8 md:py-32 lg:px-12" aria-label="What you get">
      <div className="mx-auto max-w-7xl">
        <FadeUp>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.rani }}>
            What you get
          </p>
        </FadeUp>
        <RevealText
          text="Made for the garba ground."
          className="mt-4 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
        />

        <ul className="mt-14 grid gap-4 md:grid-cols-6">
          {TILES.map((t, i) => (
            <motion.li
              key={t.title}
              className={`group relative overflow-hidden rounded-[32px] p-7 sm:p-8 ${t.span} ${t.outline ? 'ring-2 ring-[#2A0E1B]/15' : ''} ${
                t.bg !== G.cream ? 'bandhani-soft' : ''
              }`}
              style={{ backgroundColor: t.bg, color: t.fg }}
              initial={{ opacity: 0, y: 48, rotate: i % 2 ? 2 : -2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              whileHover={{ y: -6, rotate: i % 2 ? 0.6 : -0.6 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ type: 'spring', stiffness: 140, damping: 18, delay: (i % 3) * 0.08 }}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-700 group-hover:rotate-[360deg]"
                  style={{ backgroundColor: t.bg === G.cream ? G.maroon : 'rgb(255 255 255 / 0.18)', color: t.bg === G.cream ? G.cream : t.fg }}
                >
                  <t.icon className="h-6 w-6" />
                </span>
                {t.stat && (
                  <span className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] sm:text-6xl">{t.stat}</span>
                )}
              </div>
              <h3 className="mt-8 font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">{t.title}</h3>
              <p className="mt-3 max-w-xl leading-relaxed opacity-80">{t.body}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
