
/**
 * Auth Service for client-side identity and session protection.
 */

const IDENTITY_KEY = 'datasage_user_identity';

export interface UserIdentity {
  username: string;
  phone: string;
  passcodeHash: string;
}

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function initializeIdentity(username: string, phone: string, passcode: string) {
  const passcodeHash = await hashPasscode(passcode);
  const identity: UserIdentity = {
    username,
    phone,
    passcodeHash
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export async function verifyIdentity(username: string, phone: string, passcode: string): Promise<boolean> {
  const storedStr = localStorage.getItem(IDENTITY_KEY);
  if (!storedStr) return false;
  
  const stored: UserIdentity = JSON.parse(storedStr);
  const inputHash = await hashPasscode(passcode);
  
  // Verify all three identity vectors
  return (
    stored.username.toLowerCase() === username.toLowerCase() &&
    stored.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') &&
    stored.passcodeHash === inputHash
  );
}

export function getIdentity(): UserIdentity | null {
  const stored = localStorage.getItem(IDENTITY_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function isIdentitySet(): boolean {
  return localStorage.getItem(IDENTITY_KEY) !== null;
}

export function clearSession() {
  sessionStorage.removeItem('datasage_session_active');
}

export function setSessionActive() {
  sessionStorage.setItem('datasage_session_active', 'true');
}

export function isSessionActive(): boolean {
  return sessionStorage.getItem('datasage_session_active') === 'true';
}
