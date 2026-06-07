import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, canDo } from '../lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Log login to audit
    if (data.user) {
      await supabase.from('audit_log').insert({
        action: 'LOGIN',
        user_id: data.user.id,
        notes: 'User logged in'
      })
    }
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = () => {
    if (user) fetchProfile(user.id)
  }

  const can = (permission) => canDo(profile, permission)

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile,
    can,
    isAdmin: profile?.role === 'superadmin' || profile?.role === 'admin',
    isSuperAdmin: profile?.role === 'superadmin',
    isDataEntry: profile?.role === 'data_entry',
    isSalesManager: profile?.role === 'sales_manager',
    isSalesperson: profile?.role === 'salesperson',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
