import { useNavigate } from 'react-router-dom'
import { Button } from './ui'

export default function MatchDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/70 p-6" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-marigold-500">Paths collided</p>
        <h2 id="match-title" className="mt-2 text-3xl font-extrabold text-brand-700">
          It's a match!
        </h2>
        <p className="mt-2 text-neutral-600">You and {name} liked each other. Their socials are now on your Matches tab.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => navigate('/matches')}>See matches</Button>
          <Button variant="ghost" onClick={onClose}>
            Keep browsing
          </Button>
        </div>
      </div>
    </div>
  )
}
