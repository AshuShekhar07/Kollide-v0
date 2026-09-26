import type { Database } from './database.types'

type PublicSchema = Database['public']

export type Profile = PublicSchema['Tables']['profiles']['Row']
export type ProfilePrivate = PublicSchema['Tables']['profile_private']['Row']
export type Photo = PublicSchema['Tables']['photos']['Row']
export type Activity = PublicSchema['Tables']['activities']['Row']
export type Gender = PublicSchema['Enums']['gender']
export type Seeking = PublicSchema['Enums']['seeking']
