// delete-world — "Delete our world" (Settings).
//
// POST { couple_id, confirm: "delete our world" } with the caller's session
// JWT (supabase.functions.invoke sends it). Verifies who's calling and that
// they're a member of that couple, then with the service role key (only ever
// in this function's environment, never in the app):
//   1. lists every storage object under <couple_id>/ in memory-media
//      (recursively, paginated) and removes them in batches,
//   2. checks nothing is left (otherwise stops and keeps the rows),
//   3. clears both partners' avatar_path,
//   4. deletes the couple row — the FKs cascade to every table.
// Accounts stay: both of you can sign in again to an empty app.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "memory-media";
const PAGE = 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Every object path under `prefix` (folders are entries with id === null).
async function listAll(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) out.push(...(await listAll(admin, path)));
      else out.push(path);
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function count(admin: SupabaseClient, table: string, coupleId: string) {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("couple_id", coupleId);
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. who is calling (validates the JWT with Supabase Auth)
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Not signed in" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "delete our world") return json({ error: "Type “delete our world” to confirm." }, 400);
  const coupleId = typeof body?.couple_id === "string" ? body.couple_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(coupleId)) return json({ error: "Missing couple" }, 400);

  // 2. is the caller one of the two people in this couple?
  const { data: couple, error: coupleError } = await admin
    .from("couples")
    .select("id, partner_one, partner_two")
    .eq("id", coupleId)
    .maybeSingle();
  if (coupleError) return json({ error: coupleError.message }, 500);
  if (!couple || (couple.partner_one !== user.id && couple.partner_two !== user.id)) {
    return json({ error: "You're not part of this world." }, 403);
  }

  try {
    const counts = {
      memories: await count(admin, "memories", coupleId),
      bottles_and_gifts: await count(admin, "bottles", coupleId),
      days_answered: await count(admin, "daily_activities", coupleId),
      files: 0,
    };

    // 3. every file under <couple_id>/, removed in batches
    const paths = await listAll(admin, coupleId);
    for (let i = 0; i < paths.length; i += PAGE) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + PAGE));
      if (error) throw new Error(`remove: ${error.message}`);
    }
    counts.files = paths.length;
    const left = await listAll(admin, coupleId);
    if (left.length > 0) throw new Error(`${left.length} files couldn't be removed; nothing else was deleted.`);

    // 4. avatars lived under the couple folder — forget them
    const partners = [couple.partner_one, couple.partner_two].filter(Boolean);
    await admin.from("users").update({ avatar_path: null }).in("id", partners);

    // 5. the couple row; every table cascades from it
    const { error: deleteError } = await admin.from("couples").delete().eq("id", coupleId);
    if (deleteError) throw new Error(`delete couple: ${deleteError.message}`);

    return json({ ok: true, ...counts });
  } catch (e) {
    console.error("[delete-world]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
