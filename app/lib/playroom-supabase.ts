export const PLAYROOM_SUPABASE_PROJECT_REF = 'xrkwxaxsmnraygwsmdiq';

const PLAYROOM_SUPABASE_HOST = `${PLAYROOM_SUPABASE_PROJECT_REF}.supabase.co`;

export function isPlayroomSupabaseUrl(url: string): boolean {
  try {
    return new URL(url).host === PLAYROOM_SUPABASE_HOST;
  } catch {
    return false;
  }
}

/** Local, Preview, and Production all use the hosted playroom project. */
export function assertPlayroomSupabaseUrl(url: string): string {
  if (!isPlayroomSupabaseUrl(url)) {
    throw new Error(`Supabase must be the playroom project (${PLAYROOM_SUPABASE_PROJECT_REF}). playroom-dev is retired.`);
  }
  return url;
}
