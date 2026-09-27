import {
  Body,
  Button,
  Handwritten,
  Icon3D,
  Input,
  PaperCard,
  PressableScale,
  ScreenBackground,
  Title,
  WashiTape,
} from '@/components/ui';
import {
  getActivityResponses,
  getSignedActivityMediaUrl,
  getTodayActivity,
  partnerHasAnswered,
  submitActivityResponse,
  uploadActivityResponseMedia,
} from '@/lib/activities';
import { EnvelopeReveal, type RevealAnswer } from '@/components/moments/EnvelopeReveal';
import { PaperBoat } from '@/components/moments/effects';
import { SongCard } from '@/components/music/SongCard';
import { SongPicker } from '@/components/music/SongPicker';
import { usePreviewStopOnBlur } from '@/components/music/usePreviewStopOnBlur';
import { NotifyPromptCard } from '@/components/settings/NotifyPromptCard';
import { AnswerVoice } from '@/components/voice/AnswerVoice';
import { VoicePlayer } from '@/components/voice/VoicePlayer';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { asVoiceNote, MAX_ANSWER_VOICE_SECONDS, uploadVoice, type LocalVoice } from '@/lib/voice';
import { getUserName } from '@/lib/auth';
import { getMyCouple } from '@/lib/couples';
import { answersMatch, hasSeenReveal, markRevealSeen } from '@/lib/moments';
import type { Song } from '@/lib/music';
import { supabase } from '@/lib/supabase';
import { colors, ENTRANCE_DURATION, GUTTER, radius, shadows, space } from '@/theme';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TodayActivity() {
  const insets = useSafeAreaInsets();
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [dailyActivity, setDailyActivity] = useState<any>(null);
  const [myResponse, setMyResponse] = useState<any>(null);
  const [partnerResponse, setPartnerResponse] = useState<any>(null);
  const [partnerAnswered, setPartnerAnswered] = useState(false);
  const [partnerMediaUrl, setPartnerMediaUrl] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [pickedSong, setPickedSong] = useState<Song | null>(null);
  const [pickedVoice, setPickedVoice] = useState<LocalVoice | null>(null);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  usePreviewStopOnBlur();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { width } = useWindowDimensions();
  // __DEV__ "Replay reveal" opens this screen with ?replayReveal=1 (ignores "already seen").
  const { replayReveal } = useLocalSearchParams<{ replayReveal?: string }>();
  const [myId, setMyId] = useState<string | null>(null);
  const [names, setNames] = useState<{ me: string; partner: string }>({ me: 'You', partner: 'Your partner' });
  // 'envelopes' = the sealed-envelope moment (first time); 'static' = already seen
  const [reveal, setReveal] = useState<'none' | 'envelopes' | 'static'>('none');
  const arrivedLive = useRef(false);

  // `silent` = refetch without the full-screen spinner (Realtime arrival, "Check again").
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const couple = await getMyCouple();
      if (!couple) throw new Error('Could not find your world.');
      setCoupleId(couple.id);

      const activity = await getTodayActivity(couple.id);
      setDailyActivity(activity);

      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id;
      if (myId) setMyId(myId);
      const partnerId = couple.partner_one === myId ? couple.partner_two : couple.partner_one;
      const [myName, partnerName] = await Promise.all([
        myId ? getUserName(myId).catch(() => null) : null,
        partnerId ? getUserName(partnerId).catch(() => null) : null,
      ]);
      setNames({
        me: myName?.trim().split(/\s+/)[0] ?? 'You',
        partner: partnerName?.trim().split(/\s+/)[0] ?? 'Your partner',
      });

      const responses = await getActivityResponses(activity.id);
      const mine = responses.find((r) => r.user_id === myId) ?? null;
      const theirs = responses.find((r) => r.user_id !== myId) ?? null;
      setMyResponse(mine);
      setPartnerResponse(theirs);
      // Their row is hidden by RLS until I've answered, so ask the DB directly.
      setPartnerAnswered(theirs ? true : await partnerHasAnswered(activity.id));

      if (theirs?.media_url) {
        const url = await getSignedActivityMediaUrl(theirs.media_url).catch(() => null);
        setPartnerMediaUrl(url);
      }

      if (mine && theirs && myId) {
        const seen = replayReveal ? false : await hasSeenReveal(myId, activity.id);
        setReveal(seen ? 'static' : 'envelopes');
      } else {
        setReveal('none');
      }
    } catch (err: any) {
      Alert.alert('Something went wrong', err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [replayReveal]);

  // Live reveal: once I've answered, listen for my partner's answer on this
  // daily activity. RLS decides delivery — their row only reaches me because
  // I've already answered (migration 009/013). Unsubscribe on leave.
  const activityId = dailyActivity?.id as string | undefined;
  const waitingForPartner = !!myResponse && !partnerResponse;
  useEffect(() => {
    if (!activityId || !waitingForPartner || !myId) return;
    const channel = supabase
      .channel(`reveal-${activityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_responses', filter: `daily_activity_id=eq.${activityId}` },
        (payload: any) => {
          const row = payload.new as { user_id?: string } | undefined;
          if (row?.user_id && row.user_id !== myId) {
            arrivedLive.current = true;
            load(true);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activityId, waitingForPartner, myId, load]);

  const finishReveal = useCallback(() => {
    if (myId && activityId) markRevealSeen(myId, activityId);
    arrivedLive.current = false;
    setReveal('static');
  }, [myId, activityId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'We need access to your photos for this one.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled) {
      setPickedPhoto(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    const isPhotoPrompt = dailyActivity?.activities?.response_type === 'photo';
    const isSongPrompt = dailyActivity?.activities?.response_type === 'song';
    const isVoicePrompt = dailyActivity?.activities?.response_type === 'voice';

    if (isPhotoPrompt && !pickedPhoto) {
      Alert.alert('Add a photo', 'This one needs a picture, not just text.');
      return;
    }
    if (isSongPrompt && !pickedSong) {
      Alert.alert('Pick a song', 'This one needs a song.');
      return;
    }
    if (isVoicePrompt && !pickedVoice) {
      Alert.alert('Record something', 'This one needs a voice note.');
      return;
    }
    if (!isPhotoPrompt && !isSongPrompt && !isVoicePrompt && !inputText.trim()) {
      Alert.alert('Say something', 'Write your answer first.');
      return;
    }

    setSubmitting(true);
    try {
      let mediaPath: string | undefined;
      if (isPhotoPrompt && pickedPhoto && coupleId) {
        mediaPath = await uploadActivityResponseMedia({
          coupleId,
          dailyActivityId: dailyActivity.id,
          localUri: pickedPhoto,
        });
      }

      // <couple>/activity-responses/<daily>/<me>/voice-….m4a — hidden from my
      // partner by storage RLS until they've answered too (017/018).
      const voice =
        isVoicePrompt && pickedVoice && coupleId && myId
          ? await uploadVoice(`${coupleId}/activity-responses/${dailyActivity.id}/${myId}`, pickedVoice)
          : null;

      await submitActivityResponse(
        dailyActivity.id,
        inputText.trim() || (isPhotoPrompt ? '📸' : isSongPrompt ? '🎵' : isVoicePrompt ? '🎙️' : ''),
        mediaPath,
        isSongPrompt ? pickedSong : null,
        voice
      );
      setInputText('');
      setPickedPhoto(null);
      setPickedSong(null);
      setPickedVoice(null);
      // Refetch: now that I've answered, RLS lets me read their response.
      await load();
    } catch (err: any) {
      Alert.alert('Something went wrong', err.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const activity = dailyActivity?.activities;
  const responseType = activity?.response_type ?? 'text';
  const bothAnswered = myResponse && partnerResponse;

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* The prompt arrives as a note from a bottle. */}
          <View style={styles.promptWrap}>
            <Icon3D name="bottle" size={64} style={styles.bottle} />
            <PaperCard style={styles.promptCard}>
              <WashiTape color="sky" rotate={-4} style={styles.promptTape} />
              {activity?.category ? (
                <Body variant="label" color={colors.ocean}>
                  {sentenceCase(activity.category)}
                </Body>
              ) : null}
              <Title variant="heading" style={styles.prompt}>
                {activity?.title}
              </Title>
              {activity?.description ? (
                <Body color={colors.inkSoft} style={styles.description}>
                  {activity.description}
                </Body>
              ) : null}
            </PaperCard>
          </View>

          {!myResponse && (
            <View style={styles.status}>
              <Icon3D name={partnerAnswered ? 'sparkles' : 'hourglass'} size={28} />
              <Body variant="bodyStrong" color={colors.inkOcean} style={styles.flex}>
                {partnerAnswered
                  ? "Your partner's already answered — your turn"
                  : 'Waiting for your partner'}
              </Body>
            </View>
          )}

          {!myResponse && responseType === 'voice' && (
            <View style={styles.answerBox}>
              {pickedVoice ? (
                <View style={styles.voicePicked}>
                  <VoicePlayer playKey={pickedVoice.uri} uri={pickedVoice.uri} durationSeconds={pickedVoice.durationMs / 1000} waveform={pickedVoice.waveform} />
                  <Button title="Record again" variant="text" onPress={() => setPickedVoice(null)} disabled={submitting} />
                </View>
              ) : (
                <VoiceRecorder maxSeconds={MAX_ANSWER_VOICE_SECONDS} label={`Say it to ${names.partner}`} onUse={setPickedVoice} />
              )}
              {pickedVoice && <Button title="Send my voice note" onPress={handleSubmit} loading={submitting} />}
            </View>
          )}

          {!myResponse && responseType === 'photo' && (
            <View style={styles.answerBox}>
              <PressableScale
                onPress={pickPhoto}
                accessibilityRole="button"
                accessibilityLabel={pickedPhoto ? 'Change photo' : 'Choose a photo'}
                style={styles.photoPicker}
              >
                {pickedPhoto ? (
                  <Image source={{ uri: pickedPhoto }} style={styles.previewImage} contentFit="cover" />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Icon3D name="camera" size={48} />
                    <Body variant="button" color={colors.ocean}>
                      Choose a photo
                    </Body>
                  </View>
                )}
              </PressableScale>
              {pickedPhoto && (
                <Body variant="small" color={colors.inkSoft} center>
                  Tap the photo to change it.
                </Body>
              )}
              <Button title="Send my photo" onPress={handleSubmit} loading={submitting} />
            </View>
          )}

          {!myResponse && responseType === 'song' && (
            <View style={styles.answerBox}>
              {pickedSong ? (
                <SongCard song={pickedSong} onRemove={() => setPickedSong(null)} style={styles.songCard} />
              ) : (
                <Button title="Pick a song" icon="musicalNotes" variant="soft" onPress={() => setSongPickerOpen(true)} />
              )}
              <Button title="Send my song" onPress={handleSubmit} loading={submitting} disabled={!pickedSong} />
            </View>
          )}

          {!myResponse && responseType !== 'photo' && responseType !== 'song' && responseType !== 'voice' && (
            <View style={styles.answerBox}>
              <Input
                placeholder="Your answer…"
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <Button title="Send my answer" onPress={handleSubmit} loading={submitting} />
            </View>
          )}

          {myResponse && !partnerResponse && (
            <View style={styles.waiting}>
              <PaperBoat width={width - GUTTER * 2} />
              <Title variant="headingItalic" center style={styles.waitingTitle}>
                Waiting for {names.partner}…
              </Title>
              <Body color={colors.inkSoft} center>
                Your answer is in. It'll open here the moment theirs arrives.
              </Body>
              <Button title="Check again" variant="soft" onPress={() => load(true)} style={styles.checkAgain} />
              <NotifyPromptCard partnerName={names.partner} style={styles.pushCard} />
            </View>
          )}

          {bothAnswered && reveal === 'envelopes' && (
            <EnvelopeReveal
              key={activityId}
              myName={names.me}
              partnerName={names.partner}
              mine={toRevealAnswer(myResponse, null)}
              theirs={toRevealAnswer(partnerResponse, partnerMediaUrl)}
              matching={answersMatch(myResponse, partnerResponse)}
              autoOpen={arrivedLive.current}
              onDone={finishReveal}
            />
          )}

          {bothAnswered && reveal === 'static' && (
            // After the envelope moment has been seen once: the revealed answers, calmly.
            <Animated.View entering={FadeInDown.duration(ENTRANCE_DURATION)} style={styles.reveal}>
              <View style={styles.revealHeader}>
                <Icon3D name="sparklingHeart" size={56} />
                <Title variant="titleItalic" color={colors.coral} center>
                  You both answered!
                </Title>
              </View>

              {answersMatch(myResponse, partnerResponse) && (
                <Title variant="headingItalic" center>
                  Same brain again 😂❤️
                </Title>
              )}
              {myResponse.song || partnerResponse.song ? (
                <>
                  <View style={styles.songPair}>
                    <View style={styles.flex}>
                      <Body variant="label" color={colors.inkSoft} center>
                        You
                      </Body>
                      {myResponse.song ? <SongCard song={myResponse.song} compact style={styles.songCompact} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Body variant="label" color={colors.inkSoft} center>
                        Them
                      </Body>
                      {partnerResponse.song ? <SongCard song={partnerResponse.song} compact style={styles.songCompact} /> : null}
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <AnswerNote
                    who="You"
                    text={answerText(myResponse)}
                    voice={myResponse.voice}
                    tilt={-1.5}
                    tint={colors.warmWhite}
                  />
                  <AnswerNote
                    who="Them"
                    text={answerText(partnerResponse)}
                    voice={partnerResponse.voice}
                    imageUrl={partnerMediaUrl}
                    tilt={1.2}
                    tint={colors.sand}
                  />
                </>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <SongPicker visible={songPickerOpen} onClose={() => setSongPickerOpen(false)} onChoose={setPickedSong} />
    </ScreenBackground>
  );
}

// The typed answer, minus the placeholders stored for photo/song/voice answers.
function answerText(r: any): string | null {
  return r?.response && r.response !== '📸' && r.response !== '🎵' && r.response !== '🎙️' ? r.response : null;
}

function toRevealAnswer(r: any, imageUrl: string | null): RevealAnswer {
  return { text: answerText(r), song: r?.song ?? null, imageUrl, voice: asVoiceNote(r?.voice)?.waveform ?? null };
}

function sentenceCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Each answer is a handwritten note (Caveat — it's a personal note).
function AnswerNote({
  who,
  text,
  voice,
  imageUrl,
  tilt,
  tint,
}: {
  who: string;
  text?: string | null;
  voice?: unknown;
  imageUrl?: string | null;
  tilt: number;
  tint: string;
}) {
  return (
    <View style={[styles.answerNote, { backgroundColor: tint, transform: [{ rotate: `${tilt}deg` }] }]}>
      <Body variant="label" color={colors.inkSoft}>
        {who}
      </Body>
      {text ? <Handwritten style={styles.answerText}>{text}</Handwritten> : null}
      {voice ? <AnswerVoice voice={voice} style={styles.answerVoice} /> : null}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.revealImage} contentFit="cover" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: GUTTER },
  promptWrap: { marginTop: space.lg },
  bottle: { position: 'absolute', top: -28, right: space.md, zIndex: 1, transform: [{ rotate: '18deg' }] },
  promptCard: { padding: space.xl, transform: [{ rotate: '-0.8deg' }] },
  promptTape: { position: 'absolute', top: -10, left: space.xl },
  prompt: { marginTop: space.xs },
  description: { marginTop: space.sm },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
  },
  voicePicked: { gap: space.xs },
  answerVoice: { marginTop: space.sm },
  answerBox: { marginTop: space.xl, gap: space.md },
  songCard: { marginLeft: space.xl },
  songPair: { flexDirection: 'row', gap: space.md },
  songCompact: { marginTop: space.xs },
  photoPicker: {
    backgroundColor: colors.warmWhite,
    padding: space.sm,
    paddingBottom: space.xl,
    borderRadius: radius.photo,
    alignSelf: 'center',
    transform: [{ rotate: '1.5deg' }],
    ...shadows.paper,
  },
  photoEmpty: {
    width: 220,
    height: 220,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  previewImage: { width: 220, height: 220 },
  waiting: { alignItems: 'center', marginTop: space.xxl, gap: space.xs },
  waitingTitle: { marginTop: space.md },
  checkAgain: { marginTop: space.xl },
  pushCard: { marginTop: space.xl, alignSelf: 'stretch' },
  reveal: { marginTop: space.xxl, gap: space.xl },
  revealHeader: { alignItems: 'center', gap: space.sm },
  answerNote: {
    padding: space.xl,
    borderRadius: radius.paper,
    ...shadows.paper,
  },
  answerText: { marginTop: space.xs },
  revealImage: {
    width: '100%',
    height: 240,
    borderRadius: radius.photo,
    marginTop: space.md,
  },
});
