// src/lib/auth.ts — migrado de Supabase Auth pra Firebase Auth
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updatePassword as fbUpdatePassword,
  confirmPasswordReset, updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';
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

/** Traduz os códigos de erro do Firebase Auth pra mensagens em português. */
function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado';
    case 'auth/invalid-email':        return 'E-mail inválido';
    case 'auth/weak-password':        return 'Senha muito fraca (mínimo 6 caracteres)';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':   return 'E-mail ou senha incorretos';
    case 'auth/too-many-requests':    return 'Muitas tentativas — tente novamente em alguns minutos';
    case 'auth/expired-action-code':  return 'Link expirado — solicite um novo';
    case 'auth/invalid-action-code':  return 'Link inválido ou já utilizado';
    default:
      return (err as { message?: string })?.message ?? 'Erro inesperado';
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function sendPasswordReset(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendPasswordResetEmail(auth, email, {
      // handleCodeInApp: o link do e-mail volta pro nosso PasswordResetPage
      // (com ?mode=resetPassword&oobCode=...) em vez da página padrão do Firebase.
      url: getRedirectUrl('/reset-password'),
      handleCodeInApp: true,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

/** Troca a senha de um usuário já autenticado (sessão ativa). */
export async function updatePassword(
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!auth.currentUser) return { ok: false, error: 'Não autenticado' };
  try {
    await fbUpdatePassword(auth.currentUser, newPassword);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

/**
 * Confirma a redefinição de senha a partir do link recebido por e-mail —
 * usa o `oobCode` da URL, sem precisar de sessão ativa (fluxo do Firebase é
 * diferente do Supabase, que fazia login temporário via token na URL).
 */
export async function confirmPasswordResetWithCode(
  oobCode: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await confirmPasswordReset(auth, oobCode, newPassword);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function getUser(): Promise<AuthUser | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    id: user.uid,
    name: user.displayName ?? user.email?.split('@')[0] ?? 'Usuário',
    email: user.email ?? '',
  };
}
