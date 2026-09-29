import { MessageCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { useShell } from './AppShell'
import { DandiyaClash } from './Dandiya'
import Toran from './landing/Toran'
import { useSignedPhotos } from './ProfileCard'
import { Button } from './ui'

// Confetti in festival colours, burst out from where the sticks clack.
const CONFETTI = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2
  const dist = 130 + (i % 3) * 36
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist * 0.8,
    color: ['bg-marigold-400', 'bg-rani', 'bg-cream', 'bg-peacock', 'bg-saffron', 'bg-navy'][i % 6],
    size: i % 2 ? 'h-2 w-2' : 'h-3 w-1.5',
    rotate: i * 40,
  }
})

// One of the two photos, tilted towards the other, each holding up a stick.
function MatchPhoto({ path, name, side }: { path: string | null; name: string; side: -1 | 1 }) {
  const [url] = useSignedPhotos(path ? [path] : [], 'thumb')
  return (
    <motion.div
      className={`absolute bottom-0 h-40 w-32 overflow-hidden rounded-[1.75rem] border-4 border-marigold-400 bg-maroon-600 shadow-2xl shadow-black/40 ${
        side < 0 ? 'left-2' : 'right-2'
      }`}
      initial={{ x: side * 160, rotate: side * 30, opacity: 0 }}
      animate={{ x: 0, rotate: side * 8, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-5xl font-extrabold text-cream">
          {name.slice(0, 1)}
        </span>
      )}
    </motion.div>
  )
}

export default function MatchDialog({
  name,
  photoPath = null,
  onClose,
}: {
  name: string
  photoPath?: string | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const myPhoto = useShell()?.myPhoto ?? null

  return (
    <motion.div
      className="bandhani-soft fixed inset-0 z-50 flex flex-col overflow-y-auto bg-maroon-700 text-cream"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="shrink-0 pt-[env(safe-area-inset-top)]">
        <Toran className="text-cream" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="relative h-60 w-[17rem]">
          <DandiyaClash />
          {CONFETTI.map((c, i) => (
            <motion.span
              key={i}
              className={`absolute left-1/2 top-4 rounded-full ${c.color} ${c.size}`}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
              animate={{ x: c.x, y: c.y, opacity: [0, 1, 0], scale: 1, rotate: c.rotate }}
              transition={{ duration: 1.3, delay: 0.73, ease: 'easeOut' }}
            />
          ))}
          <MatchPhoto path={myPhoto} name={profile?.first_name ?? 'You'} side={-1} />
          <MatchPhoto path={photoPath} name={name} side={1} />
        </div>

        <motion.div
          className="mt-8 w-full max-w-sm"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-marigold-400">Paths collided</p>
          <h2 id="match-title" className="mt-3 text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            You kollided!
          </h2>
          <p className="mx-auto mt-4 max-w-xs text-cream/80">
            You and {name} both want to kollide. Say hi and plan your Garba night.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button variant="marigold" className="w-full py-4 text-base" onClick={() => navigate('/matches')}>
              <MessageCircle className="h-5 w-5" /> Say hi to {name}
            </Button>
            <Button variant="ghost" className="w-full !text-cream hover:!bg-white/10" onClick={onClose}>
              Keep browsing
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
