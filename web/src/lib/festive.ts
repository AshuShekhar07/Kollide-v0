// The landing page's flag colours, for tiles and badges that cycle through
// them. Each pairs a background with the text colour that reads on it.
export const FESTIVE_TILES = [
  'bg-marigold-400 text-maroon-950',
  'bg-rani text-cream',
  'bg-navy text-cream',
  'bg-peacock text-cream',
  'bg-maroon-700 text-cream',
  'bg-saffron text-cream',
  'bg-leaf text-cream',
] as const

// A stable pick from FESTIVE_TILES for an id or name.
export function festiveTile(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return FESTIVE_TILES[Math.abs(h) % FESTIVE_TILES.length]
}
