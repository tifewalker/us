import {
  getActivityResponses,
  getSignedActivityMediaUrl,
  getTodayActivity,
  partnerHasAnswered,
  submitActivityResponse,
  uploadActivityResponseMedia,
} from '@/lib/activities';
import { getMyCouple } from '@/lib/couples';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function TodayActivity() {
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [dailyActivity, setDailyActivity] = useState<any>(null);
  const [myResponse, setMyResponse] = useState<any>(null);
  const [partnerResponse, setPartnerResponse] = useState<any>(null);
  const [partnerAnswered, setPartnerAnswered] = useState(false);
  const [partnerMediaUrl, setPartnerMediaUrl] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const couple = await getMyCouple();
      if (!couple) throw new Error('Could not find our world.');
      setCoupleId(couple.id);

      const activity = await getTodayActivity(couple.id);
      setDailyActivity(activity);

      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id;

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
    } catch (err: any) {
      Alert.alert('Something went wrong', err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

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

    if (isPhotoPrompt && !pickedPhoto) {
      Alert.alert('Add a photo', 'This one needs a picture, not just text.');
      return;
    }
    if (!isPhotoPrompt && !inputText.trim()) {
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

      await submitActivityResponse(
        dailyActivity.id,
        inputText.trim() || (isPhotoPrompt ? '📸' : ''),
        mediaPath
      );
      setInputText('');
      setPickedPhoto(null);
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
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B6B" />
      </View>
    );
  }

  const activity = dailyActivity?.activities;
  const responseType = activity?.response_type ?? 'text';
  const bothAnswered = myResponse && partnerResponse;

  return (
    <View style={styles.container}>
      <Text style={styles.category}>
        {activity?.category ? `${activity.category.toUpperCase()} ✦` : ''}
      </Text>
      <Text style={styles.prompt}>{activity?.title}</Text>
      <Text style={styles.description}>{activity?.description}</Text>

      {!myResponse && (
        <Text style={styles.statusText}>
          {partnerAnswered
            ? "Your partner's already answered — your turn 👀"
            : 'Waiting for your partner'}
        </Text>
      )}

      {responseType === 'voice' && !myResponse && (
        <Text style={styles.voiceNote}>
          Voice recording is coming soon — for now, just type what you'd say.
        </Text>
      )}

      {!myResponse && responseType === 'photo' && (
        <View style={styles.answerBox}>
          <Pressable style={styles.pickButton} onPress={pickPhoto}>
            <Text style={styles.pickButtonText}>
              {pickedPhoto ? 'Change Photo' : '+ Choose a Photo'}
            </Text>
          </Pressable>
          {pickedPhoto && (
            <Image source={{ uri: pickedPhoto }} style={styles.previewImage} />
          )}
          <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Saving…' : 'Submit Photo'}</Text>
          </Pressable>
        </View>
      )}

      {!myResponse && responseType !== 'photo' && (
        <View style={styles.answerBox}>
          <TextInput
            style={styles.input}
            placeholder="Your answer…"
            placeholderTextColor="#7EC8E399"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.buttonText}>
              {submitting ? 'Saving…' : 'Submit Answer'}
            </Text>
          </Pressable>
        </View>
      )}

      {myResponse && !partnerResponse && (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>
            ❤️ Your answer is in — waiting for your partner to answer too.
          </Text>
          <Pressable style={styles.refreshButton} onPress={load}>
            <Text style={styles.refreshText}>Check again</Text>
          </Pressable>
        </View>
      )}

      {bothAnswered && (
        <View style={styles.revealBox}>
          <Text style={styles.revealHeading}>❤️ Both answered!</Text>

          <View style={styles.revealRow}>
            <Text style={styles.revealLabel}>You</Text>
            {myResponse.response && myResponse.response !== '📸' && (
              <Text style={styles.revealText}>{myResponse.response}</Text>
            )}
          </View>

          <View style={styles.revealRow}>
            <Text style={styles.revealLabel}>Them</Text>
            {partnerResponse.response && partnerResponse.response !== '📸' && (
              <Text style={styles.revealText}>{partnerResponse.response}</Text>
            )}
            {partnerMediaUrl && (
              <Image source={{ uri: partnerMediaUrl }} style={styles.revealImage} />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071A2B', padding: 24, paddingTop: 80 },
  center: { flex: 1, backgroundColor: '#071A2B', justifyContent: 'center', alignItems: 'center' },
  category: { color: '#FF6B6B', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  prompt: { color: '#FFF8EF', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  description: { color: '#7EC8E3', fontSize: 15, lineHeight: 21, marginBottom: 16 },
  statusText: { color: '#FF6B6B', fontSize: 14, fontWeight: '600', marginBottom: 16 },
  voiceNote: { color: '#7EC8E399', fontSize: 13, fontStyle: 'italic', marginBottom: 16 },
  answerBox: {},
  input: {
    backgroundColor: '#126E82',
    color: '#FFF8EF',
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  pickButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#7EC8E3',
  },
  pickButtonText: { color: '#7EC8E3', fontWeight: '600' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 14 },
  button: { backgroundColor: '#FF6B6B', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#FFF8EF', fontWeight: '600', fontSize: 16 },
  waitingBox: { alignItems: 'center', marginTop: 20 },
  waitingText: { color: '#FFF8EF', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#7EC8E3',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  refreshText: { color: '#7EC8E3', fontWeight: '600' },
  revealBox: { marginTop: 10 },
  revealHeading: { color: '#FFF8EF', fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  revealRow: { backgroundColor: '#126E82', borderRadius: 12, padding: 16, marginBottom: 12 },
  revealLabel: { color: '#FF6B6B', fontWeight: '700', marginBottom: 6 },
  revealText: { color: '#FFF8EF', fontSize: 15, lineHeight: 21 },
  revealImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 10 },
});