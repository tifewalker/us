import type { VoiceNote } from './voice';
import { preparePhoto } from './memories';
import type { Song } from './music';
import { localDateString } from './dates';
import { supabase } from './supabase';
import { uploadLocalFile } from './upload';

export async function getTodayActivity(coupleId: string) {
  const today = localDateString();

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
  // same 2048px JPEG as memory photos (iPhone originals are 3–5 MB)
  const { fullUri } = await preparePhoto(params.localUri);
  const manipulated = { uri: fullUri };

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not signed in');
  // <couple>/activity-responses/<daily_activity>/<my user id>/<file> — storage
  // RLS (017) lets only me read it until my partner has answered too.
  const fileName = `${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
  const storagePath = `${params.coupleId}/activity-responses/${params.dailyActivityId}/${authData.user.id}/${fileName}`;

  return uploadLocalFile({ localUri: manipulated.uri, path: storagePath });
}

export async function submitActivityResponse(
  dailyActivityId: string,
  response: string,
  mediaPath?: string,
  song?: Song | null,
  voice?: VoiceNote | null
) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Not signed in');

  const payload = {
    response,
    media_url: mediaPath ?? null,
    song: song ?? null,
    voice: voice ?? null,
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