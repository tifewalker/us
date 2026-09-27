import { EnvelopeReveal } from "@/components/moments/EnvelopeReveal";
import { PaperBoat } from "@/components/moments/effects";
import { BackButton } from "@/components/play/BackButton";
import { usePlayContext } from "@/components/play/usePlayContext";
import { AnswerVoice } from "@/components/voice/AnswerVoice";
import { VoiceNotesField } from "@/components/voice/VoiceNotesField";
import { Body, Button, EmptyState, Handwritten, Input, ScreenBackground, Title } from "@/components/ui";
import { answersMatch } from "@/lib/moments";
import { answerQuestion, categoryLabel, getThread, VOICE_ONLY, type Thread } from "@/lib/play";
import { asVoiceNote, MAX_ANSWER_VOICE_SECONDS, uploadVoice, type LocalVoice } from "@/lib/voice";
import { supabase } from "@/lib/supabase";
import { colors, fonts, GUTTER, radius, shadows, space } from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const seenKey = (myId: string, threadId: string) => `play.questionReveal.${myId}.${threadId}`;

// One question thread: write your answer; your partner's is hidden by the
// database until yours exists. The first time both are in, the envelope
// reveal plays (live via Realtime if you're waiting here), then it's static.
export default function QuestionThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ctx } = usePlayContext();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState<LocalVoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<"none" | "envelopes" | "static">("none");
  const arrivedLive = useRef(false);

  const load = useCallback(async () => {
    if (!ctx || !id) return;
    const t = await getThread(id, ctx.myId).catch(() => null);
    setThread(t);
    if (t?.myAnswer && t.theirAnswer) {
      let seen = false;
      try {
        seen = (await AsyncStorage.getItem(seenKey(ctx.myId, t.id))) === "1";
      } catch {}
      setReveal(seen ? "static" : "envelopes");
    } else setReveal("none");
  }, [ctx, id]);

  useEffect(() => {
    load();
  }, [load]);

  // live: once I've answered, wait for theirs
  const waiting = !!thread?.myAnswer && !thread?.theirAnswer;
  useEffect(() => {
    if (!waiting || !id || !ctx) return;
    const channel = supabase
      .channel(`question-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "question_answers", filter: `thread_id=eq.${id}` }, (payload: any) => {
        if (payload.new?.user_id && payload.new.user_id !== ctx.myId) {
          arrivedLive.current = true;
          load();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [waiting, id, ctx, load]);

  async function save() {
    if (!ctx || !thread || (!draft.trim() && !voice)) return;
    setSaving(true);
    try {
      const note = voice ? await uploadVoice(`${ctx.coupleId}/questions/${thread.id}/${ctx.myId}`, voice) : null;
      await answerQuestion(thread.id, ctx.myId, draft.trim() || null, note);
      setDraft("");
      setVoice(null);
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't save your answer", e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ctx || thread === undefined) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }
  if (!thread || !thread.question) {
    return (
      <ScreenBackground>
        <BackButton />
        <EmptyState icon="shell" message="This question isn't available right now." style={styles.center} />
      </ScreenBackground>
    );
  }

  const q = thread.question;
  const match = answersMatch({ response: thread.myAnswer }, { response: thread.theirAnswer });
  const textOf = (a: string | null) => (a && a !== VOICE_ONLY ? a : null);

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
          <BackButton />
          <View style={styles.card}>
            <Body variant="label" color={q.category === "spicy" ? colors.sunset : colors.ocean}>
              {categoryLabel(q.category)}
            </Body>
            <Title variant="heading" style={styles.cardText}>
              {q.text}
            </Title>
          </View>

          {!thread.myAnswer ? (
            <View style={styles.section}>
              {thread.partnerAnswered && (
                <Body color={colors.inkOcean}>{ctx.partnerName} already answered 👀 — write yours to read it</Body>
              )}
              <Input placeholder="Your answer…" value={draft} onChangeText={setDraft} multiline maxLength={1000} style={styles.input} />
              <VoiceNotesField
                voices={voice ? [voice] : []}
                onAdd={setVoice}
                onRemove={() => setVoice(null)}
                max={1}
                maxSeconds={MAX_ANSWER_VOICE_SECONDS}
                addLabel="Say it instead"
                recorderLabel={`Say it to ${ctx.partnerName}`}
                disabled={saving}
              />
              <Button title="Send my answer" onPress={save} loading={saving} disabled={!draft.trim() && !voice} />
            </View>
          ) : !thread.theirAnswer ? (
            <View style={[styles.section, styles.centered]}>
              <PaperBoat width={width - GUTTER * 2} />
              <Title variant="headingItalic" center>
                Waiting for {ctx.partnerName}…
              </Title>
              <Body color={colors.inkSoft} center>
                Your answer is in. It opens here the moment theirs arrives.
              </Body>
            </View>
          ) : reveal === "envelopes" ? (
            <EnvelopeReveal
              key={thread.id}
              myName="You"
              partnerName={ctx.partnerName}
              mine={{ text: textOf(thread.myAnswer), song: null, imageUrl: null, voice: asVoiceNote(thread.myVoice)?.waveform ?? null }}
              theirs={{ text: textOf(thread.theirAnswer), song: null, imageUrl: null, voice: asVoiceNote(thread.theirVoice)?.waveform ?? null }}
              matching={match}
              autoOpen={arrivedLive.current}
              onDone={async () => {
                try {
                  await AsyncStorage.setItem(seenKey(ctx.myId, thread.id), "1");
                } catch {}
                setReveal("static");
              }}
            />
          ) : (
            <View style={styles.section}>
              {match && (
                <Title variant="headingItalic" center>
                  Same brain again 😂❤️
                </Title>
              )}
              <Note who="You" text={textOf(thread.myAnswer)} voice={thread.myVoice} tint={colors.warmWhite} tilt={-1} />
              <Note who={ctx.partnerName} text={textOf(thread.theirAnswer)} voice={thread.theirVoice} tint={colors.sand} tilt={1} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function Note({ who, text, voice, tint, tilt }: { who: string; text: string | null; voice: unknown; tint: string; tilt: number }) {
  return (
    <View style={[styles.note, { backgroundColor: tint, transform: [{ rotate: `${tilt}deg` }] }]}>
      <Body variant="label" color={colors.inkSoft}>
        {who}
      </Body>
      {text ? <Handwritten style={styles.noteText}>{text}</Handwritten> : null}
      {voice ? <AnswerVoice voice={voice} style={styles.noteVoice} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  card: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.xl, marginTop: space.lg, transform: [{ rotate: "-0.8deg" }], ...shadows.paper },
  cardText: { marginTop: space.md },
  section: { marginTop: space.xl, gap: space.md },
  centered: { alignItems: "center" },
  input: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26, minHeight: 120 },
  note: { padding: space.lg, borderRadius: radius.paper, ...shadows.paper },
  noteText: { marginTop: space.xs },
  noteVoice: { marginTop: space.sm },
});
