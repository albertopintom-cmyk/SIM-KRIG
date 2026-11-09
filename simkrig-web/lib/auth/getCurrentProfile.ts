import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const getServerSupabaseClientForRequest = cache(
  createServerSupabaseClient,
);

export const getCurrentProfile = cache(async () => {
  console.log("PROFILE_START");
  const supabase = await getServerSupabaseClientForRequest();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    throw userError;
  }
  if (!user) {
    return null;
  }
  console.log("PROFILE_USER_OK");

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("username, role, is_active, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }
  console.log("PROFILE_DB_OK");

  return {
    userId: user.id,
    email: user.email ?? null,
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    is_active: profile?.is_active ?? false,
    displayName: profile?.display_name ?? null,
  };
});
