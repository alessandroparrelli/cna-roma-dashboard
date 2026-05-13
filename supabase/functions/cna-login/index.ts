// Edge Function: cna-login
// Eseguita server-side con service_role key (privata, mai esposta al browser)
// Verifica credenziali e restituisce i dati utente se corrette
// La Dashboard chiama questa function invece di fare SELECT diretta su cna_users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Gestione preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password_sha256 } = await req.json()

    if (!email || !password_sha256) {
      return new Response(
        JSON.stringify({ error: 'Email e password richieste' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Usa service_role key — questa è privata, gira solo server-side
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verifica credenziali
    const { data: users, error } = await supabase
      .from('cna_users')
      .select('id, nome, cognome, email, ruolo, attivo, avatar_base64, tabs_allowed')
      .eq('email', email)
      .eq('password_sha256', password_sha256)
      .eq('attivo', true)
      .limit(1)

    if (error) throw error

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Credenziali non valide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const user = users[0]

    // Aggiorna last_login
    await supabase
      .from('cna_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)

    // Restituisce i dati utente (senza mai esporre la password)
    return new Response(
      JSON.stringify({ user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Errore interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
