import { motion, useReducedMotion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import { fabricStyle } from '../lib/fabric'

// Each section has its own fabric: leheriya waves for Discover, mirror-work
// for Kollides, bandhani for Chats and embroidery for Profile.
const FABRICS: CSSProperties[] = [
  fabricStyle({ base: '#d4246b', accent: '#f6c33b', print: 'leheriya' }),
  fabricStyle({ base: '#7a0f2e', accent: '#f29f05', print: 'abhla' }),
  fabricStyle({ base: '#0b7a7a', accent: '#f6c33b', print: 'bandhani' }),
  {
    // Rows of zigzag stitching with French knots between them.
    backgroundColor: '#26306b',
    backgroundImage: [
      'radial-gradient(circle, #f6c33b 0 1.6px, transparent 2px)',
      'linear-gradient(135deg, #ea7ba6 0 3px, transparent 3px)',
      'linear-gradient(225deg, #ea7ba6 0 3px, transparent 3px)',
    ].join(', '),
    backgroundSize: '20px 24px, 20px 24px, 20px 24px',
    backgroundPosition: '10px 18px, 0 0, 0 0',
  },
]

/**
 * When you move to another section, a strip of that section's fabric sweeps
 * across the screen (under the header and dock) while the page changes.
 */
export default function FabricWipe({ section }: { section: number }) {
  const reduced = useReducedMotion()
  // Remember the last section during render (state derived from a prop).
  const [last, setLast] = useState({ section, sweep: 0, dir: 1 })
  if (section !== last.section) {
    const moved = section !== -1 && last.section !== -1
    setLast({ section, sweep: moved ? last.sweep + 1 : last.sweep, dir: section > last.section ? 1 : -1 })
  }

  if (reduced || last.sweep === 0 || section === -1) return null
  const dir = last.dir
  return (
    <motion.div
      key={last.sweep}
      className="pointer-events-none fixed inset-y-0 z-20 w-[max(38vw,14rem)] border-x-[5px] border-marigold-400 shadow-2xl shadow-black/30"
      style={{ ...FABRICS[section], left: 0, skewX: -10 }}
      initial={{ x: dir > 0 ? '110vw' : '-100vw' }}
      animate={{ x: dir > 0 ? '-100vw' : '110vw' }}
      transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
      aria-hidden
    />
  )
}
