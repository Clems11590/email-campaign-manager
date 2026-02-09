
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const handleSupabaseError = (error) => {
  if (error) {
    console.error('Supabase error:', error)
    alert(`Erreur: ${error.message}`)
    return true
  }
  return false
}
