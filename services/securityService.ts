
/**
 * Security Service using native Web Crypto API (SubtleCrypto)
 * Provides AES-GCM encryption for exporting sensitive analysis reports.
 */

const ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;

export async function encryptData(text: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));

  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(text)
  );

  // Combine salt + iv + ciphertext for portability
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Simple Masking logic for PII (De-identification)
 */
export function maskSensitiveData(headers: string[], rows: any[]): any[] {
  const sensitivePatterns = [/email/i, /phone/i, /name/i, /address/i, /ssn/i, /id$/i];
  const sensitiveHeaders = headers.filter(h => sensitivePatterns.some(p => p.test(h)));
  
  if (sensitiveHeaders.length === 0) return rows;

  return rows.map(row => {
    const newRow = { ...row };
    sensitiveHeaders.forEach(h => {
      if (newRow[h]) {
        // Simple hash-like representation for pattern analysis without revealing data
        newRow[h] = `[MASKED_${h.toUpperCase()}]`;
      }
    });
    return newRow;
  });
}
