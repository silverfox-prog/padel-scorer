import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl ? "✓ Set" : "✗ Missing");
console.log("Supabase Key:", supabaseAnonKey ? "✓ Set" : "✗ Missing");

export const supabaseEnabled = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
