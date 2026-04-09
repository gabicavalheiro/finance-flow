const AUTH_KEY = 'ff_auth';
const USER_KEY = 'ff_user';

export interface AuthUser {
  name: string;
  email: string;
  passwordHash: string;
}

// Simple hash (not cryptographic, just obfuscation for local storage)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function registerUser(name: string, email: string, password: string): boolean {
  if (getUser()) return false; // already registered
  const user: AuthUser = {
    name,
    email: email.toLowerCase(),
    passwordHash: simpleHash(password),
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return true;
}

export function loginUser(email: string, password: string): boolean {
  const user = getUser();
  if (!user) return false;
  if (user.email !== email.toLowerCase()) return false;
  if (user.passwordHash !== simpleHash(password)) return false;
  localStorage.setItem(AUTH_KEY, 'true');
  return true;
}

export function logoutUser() {
  localStorage.removeItem(AUTH_KEY);
}

export function isLoggedIn(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasRegistered(): boolean {
  return !!getUser();
}
