// notify-send — called by the app with the signed-in session (verify_jwt on).
// Sends ONE notification to the CALLER ONLY, bypassing prefs / quiet hours /
// dedupe (it isn't logged):
//   { kind: "test" }        Settings → "Send me a test notification"
//   { kind: "<any kind>" }  dev panel: fire each kind at yourself with sample copy
// Returns how many of your devices it reached.
import { sampleFor } from "../_shared/copy.ts";
import { adminClient, cors, deliver, firstName, json, partnerOf } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = adminClient();

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Not signed in" }, 401);

  const body = await req.json().catch(() => ({}));
  const kind = typeof body?.kind === "string" ? body.kind : "test";

  // your partner's first name for the sample copy
  let partner = "Your person";
  const { data: couple } = await admin.from("couples").select("id").or(`partner_one.eq.${user.id},partner_two.eq.${user.id}`).maybeSingle();
  if (couple) {
    const pid = await partnerOf(admin, couple.id, user.id);
    if (pid) {
      const { data: u } = await admin.from("users").select("name").eq("id", pid).maybeSingle();
      partner = firstName(u?.name);
    }
  }

  const sample = sampleFor(kind, partner);
  if (!sample) return json({ error: `Unknown kind: ${kind}` }, 400);
  try {
    const devices = await deliver(admin, user.id, { kind: `dev_${kind}`, refId: String(Date.now()), title: sample.title, url: sample.url, category: "system" });
    return json({ ok: true, devices });
  } catch (e) {
    // e.g. "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets are missing" — log it so
    // it shows in the function logs, not only in the response.
    console.error("[notify-send]", e);
    return json({ error: String(e) }, 500);
  }
});
