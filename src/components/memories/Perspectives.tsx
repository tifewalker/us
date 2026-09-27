import { EnvelopeReveal } from "@/components/moments/EnvelopeReveal";
import { Body, Button, Handwritten, Input, Title } from "@/components/ui";
import { AnswerVoice } from "@/components/voice/AnswerVoice";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import { asVoiceNote, MAX_ANSWER_VOICE_SECONDS, type LocalVoice } from "@/lib/voice";
import { hasSeenPerspective, markPerspectiveSeen } from "@/lib/moments";
import { getReflections, partnerHasReflected, saveMyReflection, type Reflection } from "@/lib/reflections";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius, shadows, space } from "@/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, useWindowDimensions, View } from "react-native";

const MAX = 2000;

// "What do you remember?" — each of you writes your side of a memory. RLS
// (015) hides your partner's side until you've written yours; the first time
// both are there, a small envelope reveal plays (then static). If you're
// waiting on the page, their side arrives live via Realtime.
export function Perspectives({
  coupleId,
  memoryId,
  myId,
  myName,
  partnerName,
}: {
  coupleId: string;
  memoryId: string;
  myId: string;
  myName: string;
  partnerName: string;
}) {
  const { width } = useWindowDimensions();
  const [mine, setMine] = useState<Reflection | null>(null);
  const [theirs, setTheirs] = useState<Reflection | null>(null);
  const [partnerWrote, setPartnerWrote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // voice while editing: a new take, "remove" (drop the saved one), or null (keep)
  const [voiceDraft, setVoiceDraft] = useState<LocalVoice | "remove" | null>(null);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<"none" | "envelopes" | "static">("none");
  const arrivedLive = useRef(false);

  const load = useCallback(async () => {
    try {
      const rows = await getReflections(memoryId);
      const m = rows.find((r) => r.user_id === myId) ?? null;
      const t = rows.find((r) => r.user_id !== myId) ?? null;
      setMine(m);
      setTheirs(t);
      setPartnerWrote(t ? true : await partnerHasReflected(memoryId));
      if (m && t) {
        const seen = await hasSeenPerspective(myId, memoryId);
        setReveal(seen ? "static" : "envelopes");
      } else {
        setReveal("none");
      }
    } catch (err: any) {
      console.log("[Perspectives] load failed:", err.message);
    }
  }, [memoryId, myId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: once I've written mine, listen for theirs (RLS delivers it only now).
  const waiting = !!mine && !theirs;
  useEffect(() => {
    if (!waiting) return;
    const channel = supabase
      .channel(`reflect-${memoryId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memory_reflections", filter: `memory_id=eq.${memoryId}` },
        (payload: any) => {
          if (payload.new?.user_id && payload.new.user_id !== myId) {
            arrivedLive.current = true;
            load();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [waiting, memoryId, myId, load]);

  const savedVoice = asVoiceNote(mine?.voice);
  const keepsVoice = !!savedVoice && voiceDraft === null;
  const hasVoice = keepsVoice || (voiceDraft !== null && voiceDraft !== "remove");

  function startEditing() {
    setDraft(mine?.text ?? "");
    setVoiceDraft(null);
    setEditing(true);
  }

  async function save() {
    if (!draft.trim() && !hasVoice) return;
    setSaving(true);
    try {
      await saveMyReflection({
        coupleId,
        memoryId,
        userId: myId,
        text: draft.trim() || null,
        voice: voiceDraft ?? undefined,
        previousVoice: mine?.voice,
      });
      setVoiceDraft(null);
      setEditing(false);
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't save your side", err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  const sideBySide = width >= 380;
  const editor = (
    <>
      <Input
        placeholder="What you remember, in your words…"
        value={draft}
        onChangeText={setDraft}
        multiline
        maxLength={MAX}
        style={styles.input}
      />
      {keepsVoice && savedVoice ? (
        <View style={styles.savedVoice}>
          <AnswerVoice voice={mine?.voice} style={styles.flex} />
          <Button title="Remove" variant="text" onPress={() => setVoiceDraft("remove")} />
        </View>
      ) : (
        <VoiceNotesField
          voices={voiceDraft && voiceDraft !== "remove" ? [voiceDraft] : []}
          onAdd={setVoiceDraft}
          onRemove={() => setVoiceDraft(savedVoice ? "remove" : null)}
          max={1}
          maxSeconds={MAX_ANSWER_VOICE_SECONDS}
          addLabel="Say it instead"
          recorderLabel="Tell it in your own voice"
          disabled={saving}
        />
      )}
      <View style={styles.row}>
        {editing && mine ? <Button title="Cancel" variant="text" onPress={() => setEditing(false)} /> : null}
        <Button title="Save my side" onPress={save} loading={saving} disabled={!draft.trim() && !hasVoice} style={styles.flexBtn} />
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <Title variant="heading">What do you remember?</Title>

      {!mine || editing ? (
        <>
          {!mine && partnerWrote && (
            <Body color={colors.inkOcean} style={styles.hint}>
              {partnerName} already wrote theirs 👀 — write yours to read it
            </Body>
          )}
          {editor}
        </>
      ) : !theirs ? (
        <>
          <Note who={myName} text={mine.text} voice={mine.voice} tint={colors.warmWhite} tilt={-1} />
          <Button title="Edit my side" variant="text" onPress={startEditing} style={styles.left} />
          <Body variant="small" color={colors.inkSoft}>
            Waiting for {partnerName}'s side…
          </Body>
        </>
      ) : reveal === "envelopes" ? (
        <EnvelopeReveal
          key={`${memoryId}-reveal`}
          myName={myName}
          partnerName={partnerName}
          mine={{ text: mine.text, song: null, imageUrl: null, voice: asVoiceNote(mine.voice)?.waveform ?? null }}
          theirs={{ text: theirs.text, song: null, imageUrl: null, voice: asVoiceNote(theirs.voice)?.waveform ?? null }}
          matching={false}
          autoOpen={arrivedLive.current}
          onDone={() => {
            markPerspectiveSeen(myId, memoryId);
            arrivedLive.current = false;
            setReveal("static");
          }}
        />
      ) : (
        <>
          <View style={sideBySide ? styles.side : styles.stack}>
            <Note who={myName} text={mine.text} voice={mine.voice} tint={colors.warmWhite} tilt={-1.2} style={sideBySide ? styles.flex : undefined} />
            <Note who={partnerName} text={theirs.text} voice={theirs.voice} tint={colors.sand} tilt={1} style={sideBySide ? styles.flex : undefined} />
          </View>
          <Button title="Edit my side" variant="text" onPress={startEditing} style={styles.left} />
        </>
      )}
    </View>
  );
}

// A paper note with their words and/or their voice (the player sits inside the note).
function Note({ who, text, voice, tint, tilt, style }: { who: string; text: string | null; voice: unknown; tint: string; tilt: number; style?: object }) {
  return (
    <View style={[styles.note, { backgroundColor: tint, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <Body variant="label" color={colors.inkSoft}>
        {who}
      </Body>
      {text ? <Handwritten style={styles.noteText}>{text}</Handwritten> : null}
      {voice ? <AnswerVoice voice={voice} style={styles.noteVoice} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xxl, gap: space.sm },
  hint: { marginTop: space.xs },
  input: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26, minHeight: 120 },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  flexBtn: { minWidth: 160 },
  left: { alignSelf: "flex-start", paddingHorizontal: 0 },
  side: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stack: { gap: space.md },
  flex: { flex: 1 },
  note: { padding: space.lg, borderRadius: radius.paper, ...shadows.paper },
  noteText: { marginTop: space.xs },
  noteVoice: { marginTop: space.sm },
  savedVoice: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
