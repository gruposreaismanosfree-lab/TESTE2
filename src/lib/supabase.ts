import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

function makeClient() {
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

export const supabase = makeClient();
