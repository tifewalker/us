import { supabase } from "./supabase";

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }, // picked up by the handle_new_user trigger
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign up succeeded but no user was returned");
  return data.user;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

// Returns the display name from public.users, or null if the row isn't
// visible (RLS) or doesn't exist.
export async function getUserName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}
