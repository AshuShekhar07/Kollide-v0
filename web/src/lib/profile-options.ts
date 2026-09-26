import type { Gender, Seeking } from './types'

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
]

export const PREFERENCE_LABELS: Record<Gender, string> = { woman: 'Women', man: 'Men', non_binary: 'Non-binary people' }

// The 1:1 feed only shows people who picked the same option.
export const SEEKING_OPTIONS: { value: Seeking; label: string; short: string }[] = [
  { value: 'friend', label: 'A friend to go with', short: 'a friend' },
  { value: 'group', label: 'A group of friends', short: 'a group of friends' },
]
