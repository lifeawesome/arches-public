import { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export const getUser = cache(async (supabase: SupabaseClient) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getUserProfile = cache(async (supabase: SupabaseClient) => {
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("*")
    .single();
  return userProfile;
});

