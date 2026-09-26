import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { requireEnv } from './http.ts'

// Service-role client. Only ever used inside edge functions.
export function serviceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
