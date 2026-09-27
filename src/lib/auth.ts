import { Platform } from "react-native";
import { supabase } from "./supabase";

// Where password-reset links land: the web app's /reset-password page (links
// from the email open in Safari, even on a phone with the app installed).
// EXPO_PUBLIC_SITE_URL overrides; on web the current origin is used.
const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ||
  (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "https://us-eight-iota.vercel.app");

// Supabase auth errors → something a person can act on.
export function friendlyAuthError(err: any): string {
  const raw = String(err?.message ?? err ?? "");
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them, or reset your password.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "There's already an account with that email — sign in instead.";
  if (m.includes("password should be at least") || m.includes("weak password")) return "Pick a password with at least 6 characters.";
  if (m.includes("unable to validate email") || m.includes("invalid email") || (m.includes("email address") && m.includes("invalid"))) return "That email doesn't look right — check it for typos.";
  if (m.includes("email not confirmed")) return "This email hasn't been confirmed yet.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "New accounts are closed — sign in with your existing one.";
  if (m.includes("rate limit") || m.includes("only request this after") || m.includes("too many")) return "Too many tries — wait a minute and try again.";
  if (m.includes("same password") || m.includes("different from the old")) return "Your new password has to be different from the old one.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Couldn't reach Us — check your connection and try again.";
  if (m.includes("auth session missing") || m.includes("expired") || m.includes("invalid")) return "This reset link has expired — ask for a new one.";
  return raw || "Something went wrong — try again.";
}

// Sends the "reset your password" email (Supabase Auth). The link opens
// <site>/reset-password with a one-time recovery session.
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${SITE_URL}/reset-password` });
  if (error) throw error;
}

// Sets a new password for the signed-in (recovery) session.
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

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
