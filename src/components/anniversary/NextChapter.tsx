import { EnvelopeReveal } from "@/components/moments/EnvelopeReveal";
import { Body, Button, Handwritten, Input, Title } from "@/components/ui";
import { AnswerVoice } from "@/components/voice/AnswerVoice";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import {
  getAnniversaryAnswers,
  partnerHasAnsweredAnniversary,
  saveAnniversaryAnswer,
  type AnniversaryAnswer,
} from "@/lib/anniversary";
import { supabase } from "@/lib/supabase";
import { asVoiceNote, MAX_ANSWER_VOICE_SECONDS, type LocalVoice } from "@/lib/voice";
import { colors, fonts, radius, shadows, space } from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

const seenKey = (myId: string, coupleId: string, year: number) => `anniversary.reveal.${myId}.${coupleId}.${year}`;

// "Where should our next chapter take us?" — text or voice (or both). Their
// answer is hidden by the database until mine exists (022); when both are in,
// the envelope reveal plays once (live via Realtime if I'm waiting), then the
// two notes stay. Used in the recap and reachable any time from Us → Our years.
export function NextChapter({
  coupleId,
  myId,
  year,
  myName,
  partnerName,
  preview = false,
}: {
  coupleId: string;
  myId: string;
  year: number;
  myName: string;
  partnerName: string;
  preview?: boolean; // dev preview: never writes
}) {
  const [mine, setMine] = useState<AnniversaryAnswer | null>(null);
  const [theirs, setTheirs] = useState<AnniversaryAnswer | null>(null);
  const [partnerAnswered, setPartnerAnswered] = useState(false);
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState<LocalVoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<"none" | "envelopes" | "static">("none");
  const arrivedLive = useRef(false);

  const load = useCallback(async () => {
    try {
      const rows = await getAnniversaryAnswers(coupleId, year);
      const m = rows.find((r) => r.user_id === myId) ?? null;
      const t = rows.find((r) => r.user_id !== myId) ?? null;
      setMine(m);
      setTheirs(t);
      setPartnerAnswered(t ? true : await partnerHasAnsweredAnniversary(year).catch(() => false));
      if (m && t) {
        let seen = false;
        try {
          seen = (await AsyncStorage.getItem(seenKey(myId, coupleId, year))) === "1";
        } catch {}
        setReveal(seen ? "static" : "envelopes");
      } else setReveal("none");
    } catch (e: any) {
      console.log("[NextChapter] load failed:", e?.message);
    }
  }, [coupleId, myId, year]);

  useEffect(() => {
    load();
  }, [load]);

  // live: once I've answered, wait for theirs (RLS delivers it only now)
  const waiting = !!mine && !theirs;
  useEffect(() => {
    if (!waiting) return;
    const channel = supabase
      .channel(`anniversary-${coupleId}-${year}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "anniversary_answers", filter: `couple_id=eq.${coupleId}` }, (payload: any) => {
        const row = payload.new as { user_id?: string; anniversary_year?: number } | undefined;
        if (row?.user_id && row.user_id !== myId && row.anniversary_year === year) {
          arrivedLive.current = true;
          load();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [waiting, coupleId, year, myId, load]);

  async function save() {
    if (preview || (!draft.trim() && !voice)) return;
    setSaving(true);
    try {
      await saveAnniversaryAnswer({ coupleId, myId, year, text: draft, voice });
      setDraft("");
      setVoice(null);
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't save your answer", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const textOf = (a: AnniversaryAnswer | null) => a?.answer ?? null;

  return (
    <View style={styles.wrap}>
      <Title variant="titleItalic" center>
        Where should our next chapter take us?
      </Title>

      {preview ? (
        <Body color={colors.inkSoft} center>
          (Preview — on the real anniversary you'll each answer here, and it opens when you both have.)
        </Body>
      ) : !mine ? (
        <View style={styles.form}>
          {partnerAnswered && (
            <Body color={colors.inkOcean} center>
              {partnerName} already answered 👀 — write yours to read it
            </Body>
          )}
          <Input placeholder="A place, a dream, a little plan…" value={draft} onChangeText={setDraft} multiline maxLength={1000} style={styles.input} />
          <VoiceNotesField
            voices={voice ? [voice] : []}
            onAdd={setVoice}
            onRemove={() => setVoice(null)}
            max={1}
            maxSeconds={MAX_ANSWER_VOICE_SECONDS}
            addLabel="Say it instead"
            recorderLabel={`Tell ${partnerName}`}
            disabled={saving}
          />
          <Button title="Seal my answer" icon="loveLetter" onPress={save} loading={saving} disabled={!draft.trim() && !voice} />
        </View>
      ) : !theirs ? (
        <View style={styles.form}>
          <Note who={myName} answer={mine} tint={colors.warmWhite} tilt={-1} />
          <Handwritten color={colors.inkSoft} center>
            Sealed. It opens the moment {partnerName} answers too.
          </Handwritten>
        </View>
      ) : reveal === "envelopes" ? (
        <EnvelopeReveal
          key={`anniv-${year}`}
          myName={myName}
          partnerName={partnerName}
          mine={{ text: textOf(mine), song: null, imageUrl: null, voice: asVoiceNote(mine.voice)?.waveform ?? null }}
          theirs={{ text: textOf(theirs), song: null, imageUrl: null, voice: asVoiceNote(theirs.voice)?.waveform ?? null }}
          matching={false}
          autoOpen={arrivedLive.current}
          onDone={async () => {
            try {
              await AsyncStorage.setItem(seenKey(myId, coupleId, year), "1");
            } catch {}
            setReveal("static");
          }}
        />
      ) : (
        <View style={styles.form}>
          <Note who={myName} answer={mine} tint={colors.warmWhite} tilt={-1.2} />
          <Note who={partnerName} answer={theirs} tint={colors.sand} tilt={1} />
        </View>
      )}
    </View>
  );
}

export function Note({ who, answer, tint, tilt }: { who: string; answer: AnniversaryAnswer; tint: string; tilt: number }) {
  return (
    <View style={[styles.note, { backgroundColor: tint, transform: [{ rotate: `${tilt}deg` }] }]}>
      <Body variant="label" color={colors.inkSoft}>
        {who}
      </Body>
      {answer.answer ? <Handwritten style={styles.noteText}>{answer.answer}</Handwritten> : null}
      {answer.voice ? <AnswerVoice voice={answer.voice} style={styles.noteVoice} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  form: { gap: space.md },
  input: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26, minHeight: 110 },
  note: { padding: space.lg, borderRadius: radius.paper, ...shadows.paper },
  noteText: { marginTop: space.xs },
  noteVoice: { marginTop: space.sm },
});
