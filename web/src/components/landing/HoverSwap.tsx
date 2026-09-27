import { motion, useAnimate, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from 'react'
import { EASE_OUT } from './motion'

type Photo = { src: string; alt: string }

const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

function subscribeHover(onChange: () => void) {
  const mq = window.matchMedia(HOVER_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useCanHover() {
  return useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(HOVER_QUERY).matches,
    () => true,
  )
}

/**
 * A tall rounded photo that opens a second photo over itself as a growing
 * circle, starting from where the cursor came in (or where it was tapped on
 * touch screens). The frame unmasks as it scrolls into view and the photos
 * drift slightly with scroll.
 */
export default function HoverSwap({ base, reveal, className = '' }: { base: Photo; reveal: Photo; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [open, setOpen] = useState(false)
  const canHover = useCanHover()
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: frameRef, offset: ['start end', 'end start'] })
  const drift = useTransform(scrollYProgress, [0, 1], reduced ? ['0%', '0%'] : ['-6%', '6%'])

  function pointAt(clientX: number, clientY: number) {
    const rect = frameRef.current!.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`
  }

  function show(at: string) {
    setOpen(true)
    const duration = reduced ? 0 : 0.75
    animate(
      '[data-swap="reveal"]',
      { clipPath: [`circle(0% at ${at})`, `circle(150% at ${at})`] },
      { duration, ease: EASE_OUT },
    )
    animate('[data-swap="base"]', { scale: 1.07 }, { duration: reduced ? 0 : 1.1, ease: EASE_OUT })
  }

  function hide(at: string) {
    setOpen(false)
    const duration = reduced ? 0 : 0.6
    animate('[data-swap="reveal"]', { clipPath: `circle(0% at ${at})` }, { duration, ease: [0.65, 0, 0.35, 1] })
    animate('[data-swap="base"]', { scale: 1 }, { duration: reduced ? 0 : 0.9, ease: EASE_OUT })
  }

  function onPointerEnter(e: PointerEvent) {
    if (e.pointerType === 'mouse') show(pointAt(e.clientX, e.clientY))
  }

  function onPointerLeave(e: PointerEvent) {
    if (e.pointerType === 'mouse') hide(pointAt(e.clientX, e.clientY))
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'mouse') return
    const at = pointAt(e.clientX, e.clientY)
    if (open) hide(at)
    else show(at)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (open) hide('50% 50%')
    else show('50% 50%')
  }

  return (
    <motion.div
      ref={frameRef}
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[#f1ece6] ${className}`}
      initial={{ clipPath: 'inset(14% 10% 14% 10% round 28px)' }}
      whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 28px)' }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1.1, ease: EASE_OUT }}
    >
      <div
        ref={scope}
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={`${base.alt}. Show another photo: ${reveal.alt}`}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#E0661A]"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <motion.div className="absolute inset-x-0 -top-[8%] h-[116%]" style={{ y: drift }}>
          <img
            data-swap="base"
            src={base.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
          <img
            data-swap="reveal"
            src={reveal.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
            style={{ clipPath: 'circle(0% at 50% 50%)' }}
          />
        </motion.div>

        <span
          className={`pointer-events-none absolute right-4 top-4 rounded-full bg-[#fff]/90 px-3 py-1 text-xs font-semibold text-[#111] shadow-sm backdrop-blur transition duration-300 ${
            open ? 'scale-90 opacity-0' : 'opacity-100'
          }`}
        >
          {canHover ? 'Hover' : 'Tap'}
        </span>
      </div>
    </motion.div>
  )
}
