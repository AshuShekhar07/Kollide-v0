import { MessageCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useSignedPhotos } from './ProfileCard'
import { Button } from './ui'

// Confetti in festival colours, burst out from the photo.
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const dist = 90 + (i % 3) * 28
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    color: ['bg-marigold-400', 'bg-brand-500', 'bg-white', 'bg-marigold-300'][i % 4],
    size: i % 2 ? 'h-2 w-2' : 'h-3 w-1.5',
    rotate: i * 40,
  }
})

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
  const [url] = useSignedPhotos(photoPath ? [photoPath] : [])
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-plum-900/95 via-plum-800/95 to-plum-950/95 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="bandhani pointer-events-none absolute inset-0 text-white/[0.06]" aria-hidden />
      <div className="relative w-full max-w-sm text-center text-white">
        <div className="relative mx-auto h-36 w-36">
          {CONFETTI.map((c, i) => (
            <motion.span
              key={i}
              className={`absolute left-1/2 top-1/2 rounded-full ${c.color} ${c.size}`}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
              animate={{ x: c.x, y: c.y, opacity: 0, scale: 1, rotate: c.rotate }}
              transition={{ duration: 1.2, delay: 0.15, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            className="relative h-full w-full overflow-hidden rounded-full border-4 border-marigold-400 bg-plum-600 shadow-2xl shadow-black/40"
            initial={{ scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            {url ? (
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-5xl font-bold">
                {name.slice(0, 1)}
              </span>
            )}
          </motion.div>
        </div>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.25em] text-marigold-300">Paths collided</p>
          <h2 id="match-title" className="mt-2 text-4xl font-extrabold">
            It's a match!
          </h2>
          <p className="mt-3 text-white/80">You and {name} liked each other. Say hi and plan your Garba night.</p>
          <div className="mt-8 flex flex-col gap-2">
            <Button variant="marigold" onClick={() => navigate('/matches')}>
              <MessageCircle className="h-5 w-5" /> Say hi
            </Button>
            <Button variant="ghost" className="!text-white hover:!bg-white/10" onClick={onClose}>
              Keep browsing
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
