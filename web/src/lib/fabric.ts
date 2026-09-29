import type { CSSProperties } from 'react'

// Every profile is dressed in its own chaniya-choli fabric: a colour and a
// print (bandhani dots, leheriya waves or abhla mirror-work), picked from the
// person's id so it stays the same wherever they appear.

type Print = 'bandhani' | 'leheriya' | 'abhla'
export type Fabric = { base: string; accent: string; print: Print }

const FABRICS: Fabric[] = [
  { base: '#d4246b', accent: '#f6c33b', print: 'bandhani' },
  { base: '#0b7a7a', accent: '#f6c33b', print: 'leheriya' },
  { base: '#7a0f2e', accent: '#f29f05', print: 'abhla' },
  { base: '#f29f05', accent: '#d4246b', print: 'bandhani' },
  { base: '#26306b', accent: '#ea7ba6', print: 'abhla' },
  { base: '#3e7c2b', accent: '#f6c33b', print: 'leheriya' },
  { base: '#e0661a', accent: '#fff4e4', print: 'bandhani' },
  { base: '#5c0b23', accent: '#f4a8c5', print: 'leheriya' },
]

export function fabricFor(key: string): Fabric {
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return FABRICS[Math.abs(h) % FABRICS.length]
}

// The fabric as a CSS background.
export function fabricStyle({ base, accent, print }: Fabric): CSSProperties {
  if (print === 'bandhani') {
    // Tie-dye: little rings with a dot in the middle, in offset rows.
    const dot = `radial-gradient(circle, ${accent} 0 1.3px, transparent 1.6px 2.6px, ${accent}cc 2.6px 3.3px, transparent 3.6px)`
    return {
      backgroundColor: base,
      backgroundImage: `${dot}, ${dot}`,
      backgroundSize: '18px 18px',
      backgroundPosition: '0 0, 9px 9px',
    }
  }
  if (print === 'leheriya') {
    // Diagonal waves of thin colour bands.
    return {
      backgroundColor: base,
      backgroundImage: `repeating-linear-gradient(135deg, transparent 0 9px, ${accent} 9px 11px, transparent 11px 15px, rgb(255 255 255 / 0.28) 15px 16px, transparent 16px 22px)`,
    }
  }
  // Abhla bharat: small round mirrors ringed in thread.
  const mirror = `radial-gradient(circle, #fffdf8 0 1.6px, #c9c6cf 1.8px 3px, ${accent} 3.2px 4.4px, transparent 4.8px)`
  return {
    backgroundColor: base,
    backgroundImage: `${mirror}, ${mirror}`,
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 12px 12px',
  }
}
