import { getSupabaseAdmin, getSupabaseAnon } from '@lib/supabaseClient';

export type CurrentUser = {
  id: string;
  email: string;
  plan: 'free' | 'premium' | 'pro';
  isGuest: boolean;
  scope?: string[];
};

export async function getCurrentUserFromAccessToken(accessToken: string): Promise<CurrentUser> {
  const token = accessToken.trim();
  if (!token) {
    throw new Error('Missing access token');
  }

  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('Invalid or expired token');
  }

  const authUser = data.user;
  const fallbackEmail = authUser.email || `guest+${authUser.id}@anon.spokio.local`;
  const isAnonymous =
    typeof (authUser as any).is_anonymous === 'boolean' ? (authUser as any).is_anonymous : undefined;

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('email, subscription_plan, is_guest')
    .eq('id', authUser.id)
    .maybeSingle();

  const plan = (profile?.subscription_plan as CurrentUser['plan'] | undefined) || 'free';
  // Prefer Auth's anonymous flag when available (source of truth for guest ↔ upgraded).
  const isGuest = typeof isAnonymous === 'boolean' ? isAnonymous : typeof profile?.is_guest === 'boolean' ? profile.is_guest : !authUser.email;

  return {
    id: authUser.id,
    email: profile?.email || fallbackEmail,
    plan,
    isGuest,
    scope: isGuest ? ['guest'] : undefined
  };
}
