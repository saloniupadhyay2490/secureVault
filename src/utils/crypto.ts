
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';

// Keep this derivation unchanged for compatibility
// with the current vault encryption.
export const deriveKeyFromPassword = (
  masterPassword: string
): string => {
  if (
    typeof masterPassword !== 'string' ||
    masterPassword.length < 8
  ) {
    throw new Error(
      'Master password must be at least 8 characters.'
    );
  }

  const salt = CryptoJS.enc.Hex.parse(
    '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d'
  );

  const key = CryptoJS.PBKDF2(masterPassword, salt, {
    keySize: 256 / 32,
    iterations: 10000,
    hasher: CryptoJS.algo.SHA256,
  });

  return key.toString(CryptoJS.enc.Base64);
};

// Create a fresh, random salt for password verification.
export const createAuthSalt = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(16);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

// Derive a separate verifier from the password and salt.
export const deriveAuthVerifier = (
  masterPassword: string,
  saltHex: string
): string => {
  if (!/^[0-9a-f]{32}$/i.test(saltHex)) {
    throw new Error('Invalid authentication salt.');
  }

  const salt = CryptoJS.enc.Hex.parse(saltHex);

  const verifier = CryptoJS.PBKDF2(masterPassword, salt, {
    keySize: 256 / 32,
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256,
  });

  return verifier.toString(CryptoJS.enc.Hex);
};