import { supabase } from "./supabase";

// Simple readable invite code, e.g. "BLUE-OCEAN-4821"
function generateInviteCode(): string {
  const words = [
    "BLUE",
    "OCEAN",
    "CORAL",
    "SUNSET",
    "PALM",
    "WAVE",
    "STAR",
    "BEACH",
  ];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word1}-${word2}-${num}`;
}

export async function createCouple(relationshipStart: string) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Not signed in");

  const inviteCode = generateInviteCode();

  const { data, error } = await supabase
    .from("couples")
    .insert({
      partner_one: authData.user.id,
      relationship_start: relationshipStart, // 'YYYY-MM-DD'
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (error) throw error;
  return data; // includes data.invite_code to show/share
}

// Joins via the join_couple RPC (migration 009), which claims partner_two and
// clears the invite code atomically. Returns the joined couple's id.
export async function joinCoupleByCode(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_couple", {
    code: inviteCode,
  });

  if (error) {
    if (error.message.includes("invalid or used invite code")) {
      throw new Error("That code doesn't exist or was already used.");
    }
    if (error.message.includes("already in a couple")) {
      throw new Error("You're already paired.");
    }
    if (error.message.includes("not authenticated")) {
      throw new Error("Not signed in");
    }
    throw error;
  }
  return data as string;
}

// Returns the current user's couple row, or null if they haven't paired yet
export async function getMyCouple() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data, error } = await supabase
    .from("couples")
    .select("*")
    .or(`partner_one.eq.${authData.user.id},partner_two.eq.${authData.user.id}`)
    .maybeSingle();

  if (error) throw error;
  return data;
}
