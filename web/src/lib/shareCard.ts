import type { Fabric } from './fabric'
import type { Festival } from './festival'

// Draws the "we kollided" card for Instagram/WhatsApp stories (1080 x 1920):
// both first names, two dandiyas clacking over two medallions, and a ticket
// with the plan so far. There's no venue unless the person types one: until
// they've decided, the card says so.

export type ShareCardInput = {
  me: { name: string; photoUrl: string | null }
  // `name` null hides their name; `photoUrl` null shows their fabric instead.
  them: { name: string | null; photoUrl: string | null; fabric: Fabric }
  venue: string
  festival: Festival
  // The wordmark's SVG markup, drawn at the top.
  wordmark: string | null
  site: string
}

const W = 1080
const H = 1920
const C = {
  maroon: '#7a0f2e',
  ink: '#2a0e1b',
  cream: '#fff4e4',
  rani: '#d4246b',
  marigold: '#f29f05',
  haldi: '#f6c33b',
  peacock: '#0b7a7a',
  saffron: '#e0661a',
  navy: '#26306b',
}
const DISPLAY = '"Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif'
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif'

function loadImage(src: string, cors = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// Shrinks the font until the text fits the width.
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
    s -= 4
  } while (s > 24)
  return s
}

function background(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.maroon
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 760)
  glow.addColorStop(0, 'rgba(246,195,59,0.30)')
  glow.addColorStop(1, 'rgba(246,195,59,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  // Bandhani dots.
  ctx.fillStyle = 'rgba(255,244,228,0.10)'
  for (let y = 0; y < H + 40; y += 40) {
    for (let x = (y / 40) % 2 ? 20 : 0; x < W + 40; x += 40) {
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function toran(ctx: CanvasRenderingContext2D) {
  const colours = [C.haldi, C.rani, C.peacock, C.saffron, C.cream, C.navy]
  const n = 15
  const step = W / n
  ctx.strokeStyle = 'rgba(255,244,228,0.6)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 34)
  ctx.quadraticCurveTo(W / 2, 64, W, 34)
  ctx.stroke()
  for (let i = 0; i < n; i++) {
    const x = step * i + step / 2
    const t = x / W
    const y = 34 + 4 * 30 * t * (1 - t)
    ctx.fillStyle = colours[i % colours.length]
    ctx.beginPath()
    ctx.moveTo(x - 30, y)
    ctx.lineTo(x + 30, y)
    ctx.lineTo(x, y + 84)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(x, y + 22, 6, 0, Math.PI * 2)
    ctx.fill()
  }
}

// A dandiya from grip to tip, with coloured bands near each end.
function stick(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, main: string, band: string) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 34
  ctx.beginPath()
  ctx.moveTo(x1 + 6, y1 + 8)
  ctx.lineTo(x2 + 6, y2 + 8)
  ctx.stroke()
  ctx.strokeStyle = main
  ctx.lineWidth = 30
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.lineCap = 'butt'
  ctx.strokeStyle = band
  for (const [a, b] of [
    [0.06, 0.12],
    [0.15, 0.18],
    [0.86, 0.9],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a)
    ctx.lineTo(x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)
    ctx.stroke()
  }
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 120)
  glow.addColorStop(0, 'rgba(255,255,255,0.95)')
  glow.addColorStop(0.3, 'rgba(246,195,59,0.6)')
  glow.addColorStop(1, 'rgba(246,195,59,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineCap = 'round'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    const r1 = 58
    const r2 = i % 2 ? 100 : 128
    ctx.strokeStyle = i % 2 ? C.rani : C.haldi
    ctx.lineWidth = i % 2 ? 8 : 11
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1)
    ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2)
    ctx.stroke()
  }
}

// The person's fabric as a canvas pattern, big enough to read on a story.
function fabricPattern(ctx: CanvasRenderingContext2D, { base, accent, print }: Fabric) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 60
  const t = tile.getContext('2d')!
  t.fillStyle = base
  t.fillRect(0, 0, 60, 60)
  if (print === 'leheriya') {
    t.strokeStyle = accent
    t.lineWidth = 6
    for (let i = -60; i < 120; i += 30) {
      t.beginPath()
      t.moveTo(i, 0)
      t.lineTo(i + 60, 60)
      t.stroke()
    }
  } else {
    for (const [cx, cy] of [
      [15, 15],
      [45, 45],
    ]) {
      if (print === 'abhla') {
        t.fillStyle = accent
        t.beginPath()
        t.arc(cx, cy, 11, 0, Math.PI * 2)
        t.fill()
        t.fillStyle = '#d4d1da'
        t.beginPath()
        t.arc(cx, cy, 7.5, 0, Math.PI * 2)
        t.fill()
        t.fillStyle = '#fff'
        t.beginPath()
        t.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2)
        t.fill()
      } else {
        t.strokeStyle = accent
        t.lineWidth = 3
        t.beginPath()
        t.arc(cx, cy, 8, 0, Math.PI * 2)
        t.stroke()
        t.fillStyle = accent
        t.beginPath()
        t.arc(cx, cy, 3.5, 0, Math.PI * 2)
        t.fill()
      }
    }
  }
  return ctx.createPattern(tile, 'repeat')!
}

function medallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  img: HTMLImageElement | null,
  fallback: { letter: string; fill: CanvasPattern | string },
) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  ctx.fillStyle = C.haldi
  ctx.beginPath()
  ctx.arc(cx, cy, r + 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // Mirror studs round the ring.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ctx.fillStyle = i % 2 ? C.rani : '#fffdf8'
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8), 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    // Cover, favouring the top third where faces usually are.
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height)
    const w = img.width * s
    const h = img.height * s
    ctx.drawImage(img, cx - w / 2, cy - r - (h - r * 2) * 0.3, w, h)
  } else {
    ctx.fillStyle = fallback.fill
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = 'rgba(42,14,27,0.35)'
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = C.cream
    ctx.font = `800 ${Math.round(r * 1.05)}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(fallback.letter, cx, cy + r * 0.06)
  }
  ctx.restore()
}

function checkbox(ctx: CanvasRenderingContext2D, x: number, y: number, done: boolean) {
  const s = 46
  if (done) {
    ctx.fillStyle = C.rani
    roundRect(ctx, x, y, s, s, 12)
    ctx.fill()
    ctx.strokeStyle = C.cream
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x + 11, y + 24)
    ctx.lineTo(x + 20, y + 33)
    ctx.lineTo(x + 36, y + 14)
    ctx.stroke()
  } else {
    ctx.strokeStyle = C.rani
    ctx.lineWidth = 4
    ctx.setLineDash([8, 6])
    roundRect(ctx, x + 2, y + 2, s - 4, s - 4, 11)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function festivalLine(f: Festival) {
  if (f.phase === 'before') return f.days === 1 ? 'Navratri starts tomorrow' : `${f.days} days to Navratri`
  if (f.phase === 'during') return `Night ${f.night} of Navratri · ${f.info.colour} night`
  return 'Navratri 2026 · India'
}

export async function drawShareCard(input: ShareCardInput): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`800 120px ${DISPLAY}`),
    document.fonts.load(`700 40px ${SANS}`),
    document.fonts.load(`600 40px ${SANS}`),
  ]).catch(() => undefined)

  const [mine, theirs, wordmark] = await Promise.all([
    input.me.photoUrl ? loadImage(input.me.photoUrl) : null,
    input.them.photoUrl ? loadImage(input.them.photoUrl) : null,
    input.wordmark
      ? loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(input.wordmark)}`, false)
      : null,
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  background(ctx)
  toran(ctx)

  if (wordmark) {
    const w = 400
    const h = (wordmark.height / wordmark.width) * w || 120
    ctx.drawImage(wordmark, (W - w) / 2, 170, w, h)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.haldi
  ctx.font = `700 40px ${SANS}`
  ctx.letterSpacing = '12px'
  ctx.fillText('WE KOLLIDED', W / 2 + 6, 400)
  ctx.letterSpacing = '0px'

  // Sticks cross over the two medallions and clack above them.
  stick(ctx, 250, 930, 575, 520, C.rani, C.haldi)
  stick(ctx, 830, 930, 505, 520, C.haldi, C.rani)
  spark(ctx, 540, 545)

  const theirLetter = input.them.name ? input.them.name.slice(0, 1).toUpperCase() : '?'
  medallion(ctx, 300, 800, 180, mine, { letter: input.me.name.slice(0, 1).toUpperCase(), fill: C.peacock })
  medallion(ctx, 780, 800, 180, theirs, { letter: theirLetter, fill: fabricPattern(ctx, input.them.fabric) })

  const names = `${input.me.name} & ${input.them.name ?? 'someone'}`
  ctx.fillStyle = C.cream
  const size = fitText(ctx, names, 800, 132, DISPLAY, 940)
  ctx.font = `800 ${size}px ${DISPLAY}`
  ctx.fillText(names, W / 2, 1115)
  ctx.fillStyle = 'rgba(255,244,228,0.78)'
  ctx.font = `600 42px ${SANS}`
  ctx.fillText(festivalLine(input.festival), W / 2, 1190)

  // The plan, on a ticket with notches cut out of both sides.
  const tx = 110
  const ty = 1260
  const tw = W - 220
  const th = 400
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 14
  ctx.fillStyle = C.cream
  roundRect(ctx, tx, ty, tw, th, 36)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = C.maroon
  for (const x of [tx, tx + tw]) {
    ctx.beginPath()
    ctx.arc(x, ty + th / 2, 30, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(212,36,107,0.35)'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 10])
  roundRect(ctx, tx + 18, ty + 18, tw - 36, th - 36, 24)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.textAlign = 'left'
  ctx.fillStyle = C.rani
  ctx.font = `700 30px ${SANS}`
  ctx.letterSpacing = '8px'
  ctx.fillText('THE PLAN', tx + 70, ty + 90)
  ctx.letterSpacing = '0px'

  const venue = input.venue.trim()
  const rows: [boolean, string][] = [
    [true, 'Found each other'],
    [
      true,
      input.festival.phase === 'during'
        ? `Tonight’s colour: ${input.festival.info.colour.toLowerCase()}`
        : 'Outfits: in the works',
    ],
    [!!venue, venue ? `Garba at ${venue}` : 'Venue: still deciding'],
  ]
  rows.forEach(([done, label], i) => {
    const y = ty + 140 + i * 78
    checkbox(ctx, tx + 70, y, done)
    ctx.fillStyle = done ? C.ink : 'rgba(42,14,27,0.6)'
    const s = fitText(ctx, label, 700, 44, SANS, tw - 210)
    ctx.font = `700 ${s}px ${SANS}`
    ctx.fillText(label, tx + 140, y + 38)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,244,228,0.85)'
  ctx.font = `600 36px ${SANS}`
  ctx.fillText('Find people to show up with, not just swipe past.', W / 2, 1765)
  ctx.fillStyle = C.haldi
  ctx.font = `800 44px ${DISPLAY}`
  ctx.fillText(input.site, W / 2, 1838)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/jpeg', 0.92),
  )
}
