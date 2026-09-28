// The landing page's garba palette: chaniya-choli colours on a warm cream
// page. Fixed hex values so the page looks the same in dark mode.
export const G = {
  cream: '#FFF4E4',
  ink: '#2A0E1B',
  maroon: '#7A0F2E',
  rani: '#D4246B',
  marigold: '#F29F05',
  haldi: '#F6C33B',
  peacock: '#0B7A7A',
  leaf: '#3E7C2B',
  orange: '#E0661A',
} as const

// Flag and dot colours, cycled in order.
export const FESTIVE = [G.rani, G.marigold, G.peacock, G.haldi, G.maroon, G.leaf] as const
