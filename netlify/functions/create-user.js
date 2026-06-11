const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const ANON_KEY    = process.env.REACT_APP_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('Missing env vars: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfiguration — contact the system administrator.' }) }
  }

  // ── 1. Verify caller is an authenticated admin ──────────────────────────────
  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing authorization token.' }) }
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user: caller }, error: callerErr } = await anonClient.auth.getUser()
  if (callerErr || !caller) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session. Please sign in again.' }) }
  }

  const { data: callerProfile, error: profileErr } = await anonClient
    .from('profiles')
    .select('perm_manage_users')
    .eq('id', caller.id)
    .single()

  if (profileErr || !callerProfile?.perm_manage_users) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'You do not have permission to create users.' }) }
  }

  // ── 2. Parse and validate body ───────────────────────────────────────────────
  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body.' }) }
  }

  const { email, password, full_name, role, team } = body

  if (!email || !password || !full_name || !role) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email, password, full name, and role are all required.' }) }
  }

  // ── 3. Create auth user (email pre-confirmed, no email sent) ─────────────────
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (authError) {
    const msg = authError.message || ''
    const isDuplicate =
      msg.toLowerCase().includes('already been registered') ||
      msg.toLowerCase().includes('already exists') ||
      authError.code === 'email_exists'

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: isDuplicate
          ? `${email} is already registered. Use a different email address.`
          : `Could not create auth user: ${msg}`,
        code: isDuplicate ? 'email_exists' : 'auth_error',
      }),
    }
  }

  const uid = authData.user.id

  // ── 4. Insert profile row ────────────────────────────────────────────────────
  const { error: insertError } = await adminClient.from('profiles').insert({
    id: uid,
    full_name,
    email,
    role,
    team: team || null,
    is_active: true,
  })

  if (insertError) {
    // Roll back: delete the auth user so we don't leave a dangling account
    await adminClient.auth.admin.deleteUser(uid)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: `Auth account created but profile setup failed: ${insertError.message}. The account has been removed — please try again.`,
        code: 'profile_error',
      }),
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, userId: uid, full_name }),
  }
}
