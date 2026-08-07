import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http');

// This creates a singleton instance of the Supabase client
export const supabase = createClient(
    isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co', 
    supabaseAnonKey || 'placeholder'
)
