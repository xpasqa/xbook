const SUPABASE_URL = window.PUBLION_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.PUBLION_SUPABASE_ANON_KEY || "";

let supabasePromise;

export function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
}

export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;

  if (!supabasePromise) {
    supabasePromise = import("https://esm.sh/@supabase/supabase-js@2.106.1").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    );
  }

  return supabasePromise;
}

export async function getCurrentSession() {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("Gagal membaca sesi Supabase:", error.message);
    return null;
  }

  return data.session;
}
