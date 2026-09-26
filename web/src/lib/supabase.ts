import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env } from './env'

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
