import { supabase } from './supabase';
import { isNativeApp } from '@/hooks/usePlatform';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Retorna a URL de redirect correta dependendo da plataforma.
 * - No app nativo: usa deep link customizado (financeflow://)
 * - No browser: usa a origin atual
 */
function getRedirectUrl(path = ''): string {
  if (isNativeApp()) {
    return `financeflow://${path}`;
  }
  return `${window.location.origin}${path}`;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Erro ao criar conta' };
  return { ok: true };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logoutUser(): Promise<void> {
  await supabase.auth.signOut();
}

export async function sendPasswordReset(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Redireciona pro app nativo ou pro site dependendo de onde está
    redirectTo: getRedirectUrl('/reset-password'),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updatePassword(
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getUser(): Promise<AuthUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuário',
    email: user.email ?? '',
  };
}
