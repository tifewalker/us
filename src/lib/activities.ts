import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayActivity(coupleId: string) {
  const today = todayDateString();

  const { data: existing, error: fetchError } = await supabase
    .from('daily_activities')
    .select('*, activities(*)')
    .eq('couple_id', coupleId)
    .eq('activity_date', today)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: catalog, error: catalogError } = await supabase
    .from('activities')
    .select('*');

  if (catalogError) throw catalogError;
  if (!catalog || catalog.length === 0) {
    throw new Error('No activities have been seeded yet.');
  }

  const chosen = catalog[Math.floor(Math.random() * catalog.length)];

  const { data: created, error: createError } = await supabase
    .from('daily_activities')
    .insert({ couple_id: coupleId, activity_id: chosen.id, activity_date: today })
    .select('*, activities(*)')
    .single();

  if (createError) {
    if (createError.code === '23505') {
      const { data: winner, error: refetchError } = await supabase
        .from('daily_activities')
        .select('*, activities(*)')
        .eq('couple_id', coupleId)
        .eq('activity_date', today)
        .single();
      if (refetchError) throw refetchError;
      return winner;
    }
    throw createError;
  }

  return created;
}

// Uploads a photo response into the same private bucket used for
// memories, under a path scoped to this couple + daily activity.
export async function uploadActivityResponseMedia(params: {
  coupleId: string;
  dailyActivityId: string;
  localUri: string;
}) {
  const manipulated = await ImageManipulator.manipulateAsync(
    params.localUri,
    [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  const fileName = `${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
  const storagePath = `${params.coupleId}/activity-responses/${params.dailyActivityId}/${fileName}`;

  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error: uploadError } = await supabase.storage
    .from('memory-media')
    .upload(storagePath, decode(base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;
  return storagePath;
}

export async function submitActivityResponse(
  dailyActivityId: string,
  response: string,
  mediaPath?: string
) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not signed in');

  const payload = {
    response,
    media_url: mediaPath ?? null,
    completed_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('activity_responses')
    .select('*')
    .eq('daily_activity_id', dailyActivityId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('activity_responses')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('activity_responses')
    .insert({
      daily_activity_id: dailyActivityId,
      user_id: authData.user.id,
      ...payload,
    })
    .select()
    .single();

  if (error) {
    // activity_responses_one_per_user (migration 009): an answer already
    // landed (e.g. double-tap) — treat as answered and return that row.
    if (error.code === '23505') {
      const { data: already, error: refetchError } = await supabase
        .from('activity_responses')
        .select('*')
        .eq('daily_activity_id', dailyActivityId)
        .eq('user_id', authData.user.id)
        .single();
      if (refetchError) throw refetchError;
      return already;
    }
    throw error;
  }
  return data;
}

// The partner's response row isn't readable until I've answered (RLS,
// migration 009), so this RPC is the only way to know they've answered.
export async function partnerHasAnswered(dailyActivityId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('partner_has_answered', {
    target_daily_activity_id: dailyActivityId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function getActivityResponses(dailyActivityId: string) {
  const { data, error } = await supabase
    .from('activity_responses')
    .select('*')
    .eq('daily_activity_id', dailyActivityId);

  if (error) throw error;
  return data;
}

export async function getSignedActivityMediaUrl(storagePath: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from('memory-media')
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}