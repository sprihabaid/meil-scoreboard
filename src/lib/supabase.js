import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Role permission helpers
export const ROLE_HIERARCHY = {
  superadmin: 5,
  admin: 4,
  sales_manager: 3,
  data_entry: 2,
  salesperson: 1
}

export const canDo = (profile, permission) => {
  if (!profile) return false
  return profile[`perm_${permission}`] === true
}

export const LEVEL_CONFIG = {
  Trainee: { min: 0,    color: '#6B7280', icon: '🌱', next: 'Hustler',  nextMin: 50   },
  Hustler:  { min: 50,  color: '#3B82F6', icon: '⚡', next: 'Closer',   nextMin: 200  },
  Closer:   { min: 200, color: '#8B5CF6', icon: '🔥', next: 'Elite',    nextMin: 500  },
  Elite:    { min: 500, color: '#F59E0B', icon: '💎', next: 'Legend',   nextMin: 1000 },
  Legend:   { min: 1000,color: '#EF4444', icon: '👑', next: null,       nextMin: null }
}

export const MEIL_COLORS = {
  prussianBlue: '#012D4C',
  electricBlue: '#015998',
  appleGreen:   '#5AB947',
  white:        '#FFFFFF',
  // Extended palette
  amber:        '#F59E0B',
  red:          '#EF4444',
  purple:       '#8B5CF6',
  cyan:         '#06B6D4',
  orange:       '#F97316',
  emerald:      '#10B981',
}
