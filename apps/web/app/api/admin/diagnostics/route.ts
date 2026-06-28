import { adminClient, hasSupabaseEnv, requireAdmin } from '../../../lib/server-data';

const R2_ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
] as const;

async function countRows(table: string) {
  const supabase = adminClient();
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const missingR2 = R2_ENV_KEYS.filter((key) => !process.env[key]);
  const diagnostics = {
    checkedAt: new Date().toISOString(),
    supabase: {
      configured: hasSupabaseEnv(),
      ok: false,
      stationsCount: null as number | null,
      messagesCount: null as number | null,
      messageImagesCount: null as number | null,
      error: '',
    },
    r2: {
      configured: missingR2.length === 0,
      missing: missingR2,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? '',
    },
  };

  if (!diagnostics.supabase.configured) {
    diagnostics.supabase.error = 'Missing Supabase environment variables';
    return Response.json(diagnostics);
  }

  try {
    const [stationsCount, messagesCount, messageImagesCount] = await Promise.all([
      countRows('stations'),
      countRows('messages'),
      countRows('message_images'),
    ]);
    diagnostics.supabase.ok = true;
    diagnostics.supabase.stationsCount = stationsCount;
    diagnostics.supabase.messagesCount = messagesCount;
    diagnostics.supabase.messageImagesCount = messageImagesCount;
  } catch (error) {
    diagnostics.supabase.error = error instanceof Error ? error.message : 'Supabase check failed';
  }

  return Response.json(diagnostics);
}
