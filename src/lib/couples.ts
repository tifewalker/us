import { supabase } from "./supabase";

// Creates via the create_couple RPC (migration 010), which refuses if you're
// already paired and generates the invite code (e.g. "BLUE-OCEAN-4821") server-side.
export async function createCouple(relationshipStart: string) {
  const { data, error } = await supabase.rpc("create_couple", {
    start_date: relationshipStart, // 'YYYY-MM-DD'
  });

  if (error) {
    if (error.message.includes("already in a couple")) {
      throw new Error("You're already paired.");
    }
    if (error.message.includes("not authenticated")) {
      throw new Error("Not signed in");
    }
    throw error;
  }
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
