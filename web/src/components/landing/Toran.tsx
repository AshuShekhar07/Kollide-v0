import { FESTIVE } from './garba'

// A toran: the festive string of triangular flags hung over doorways and
// garba grounds. Each flag sways a little out of step with its neighbours.
export default function Toran({ className = '', count = 44 }: { className?: string; count?: number }) {
  return (
    <div className={`pointer-events-none relative h-10 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-x-0 top-1 h-px bg-current opacity-40" />
      <div className="flex justify-between px-1">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="relative block h-8 w-6 shrink-0 origin-top animate-sway sm:h-9 sm:w-7"
            style={{
              backgroundColor: FESTIVE[i % FESTIVE.length],
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              animationDelay: `${-(i % 7) * 0.45}s`,
            }}
          >
            {/* A little mirror-work dot. */}
            <span className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#fff]/80" />
          </span>
        ))}
      </div>
    </div>
  )
}
