import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log("=== SUPABASE ENV CHECK ===");
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(
  "KEY EXISTS:",
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
console.log(
  "KEY LENGTH:",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length ?? 0
);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
