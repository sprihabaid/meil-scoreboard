const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
  const ANON_KEY    = process.env.REACT_APP_SUPABASE_ANON_KEY
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing = [
    !SUPABASE_URL  && 'REACT_APP_SUPABASE_URL',
    !ANON_KEY      && 'REACT_APP_SUPABASE_ANON_KEY',
    !SERVICE_KEY   && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)

  if (missing.length > 0) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}` }) }
  }

  // ── Verify caller has perm_manage_users ──
  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing authorization token.' }) }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user: caller } } = await anonClient.auth.getUser()
  if (!caller) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session.' }) }

  const { data: callerProfile } = await anonClient.from('profiles').select('perm_manage_users').eq('id', caller.id).single()
  if (!callerProfile?.perm_manage_users) return { statusCode: 403, headers, body: JSON.stringify({ error: 'You do not have permission to delete users.' }) }

  // ── Parse body ──
  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body.' }) }
  }

  const { userId } = body
  if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId is required.' }) }

  // Prevent self-deletion
  if (userId === caller.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You cannot delete your own account.' }) }

  // ── Delete auth user (cascades to profiles via ON DELETE CASCADE) ──
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
}
