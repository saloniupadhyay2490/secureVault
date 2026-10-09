export interface PasswordGeneratorOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 - 100
  label: 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
  color: string;
  rules: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

const UPPER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const NUMBER_CHARS = '0123456789';
const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export function generatePassword(options: PasswordGeneratorOptions = {}): string {
  const {
    length = 16,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let pool = '';
  const guaranteed: string[] = [];

  if (uppercase) {
    pool += UPPER_CHARS;
    guaranteed.push(UPPER_CHARS[Math.floor(Math.random() * UPPER_CHARS.length)]);
  }
  if (lowercase) {
    pool += LOWER_CHARS;
    guaranteed.push(LOWER_CHARS[Math.floor(Math.random() * LOWER_CHARS.length)]);
  }
  if (numbers) {
    pool += NUMBER_CHARS;
    guaranteed.push(NUMBER_CHARS[Math.floor(Math.random() * NUMBER_CHARS.length)]);
  }
  if (symbols) {
    pool += SYMBOL_CHARS;
    guaranteed.push(SYMBOL_CHARS[Math.floor(Math.random() * SYMBOL_CHARS.length)]);
  }

  // Fallback if none selected
  if (!pool) {
    pool = LOWER_CHARS + NUMBER_CHARS;
  }

  const targetLength = Math.max(8, Math.min(32, length));
  const remainingCount = targetLength - guaranteed.length;

  const result: string[] = [...guaranteed];
  for (let i = 0; i < remainingCount; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    result.push(pool[randomIndex]);
  }

  // Shuffle array
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const pass = password || '';
  const minLength = pass.length >= 8;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSymbol = /[^A-Za-z0-9]/.test(pass);

  let rawPoints = 0;
  if (minLength) rawPoints += 25;
  if (pass.length >= 12) rawPoints += 15;
  if (pass.length >= 16) rawPoints += 10;
  if (hasUpper) rawPoints += 15;
  if (hasLower) rawPoints += 10;
  if (hasNumber) rawPoints += 15;
  if (hasSymbol) rawPoints += 10;

  const score = Math.min(100, rawPoints);

  let label: 'Weak' | 'Medium' | 'Strong' | 'Very Strong' = 'Weak';
  let color = '#EF4444'; // Red

  if (score >= 90) {
    label = 'Very Strong';
    color = '#06B6D4'; // Cyan
  } else if (score >= 70) {
    label = 'Strong';
    color = '#10B981'; // Emerald
  } else if (score >= 40) {
    label = 'Medium';
    color = '#F59E0B'; // Amber
  } else {
    label = 'Weak';
    color = '#EF4444'; // Red
  }

  return {
    score,
    label,
    color,
    rules: {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol,
    },
  };
}

export interface SecurityScoreOverview {
  overallScore: number;
  label: string;
  color: string;
  totalVaults: number;
  strongCount: number;
  weakCount: number;
  oldCount: number;
  favoritesCount: number;
  verifiedCount: number;
}

export function calculateVaultSecurityMetrics(
  items: {
    isFavorite?: boolean;
    hasVerifiedEmail?: boolean;
    createdAt?: string;
    updatedAt?: string;
    strengthScore?: number;
  }[]
): SecurityScoreOverview {
  const totalVaults = items.length;
  if (totalVaults === 0) {
    return {
      overallScore: 100,
      label: 'Optimal Vault',
      color: '#10B981',
      totalVaults: 0,
      strongCount: 0,
      weakCount: 0,
      oldCount: 0,
      favoritesCount: 0,
      verifiedCount: 0,
    };
  }

  let strongCount = 0;
  let weakCount = 0;
  let oldCount = 0;
  let favoritesCount = 0;
  let verifiedCount = 0;
  let sumScore = 0;

  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  for (const item of items) {
    if (item.isFavorite) favoritesCount++;
    if (item.hasVerifiedEmail) verifiedCount++;

    const itemDate = item.updatedAt || item.createdAt;
    if (itemDate) {
      const parsedDate = new Date(itemDate).getTime();
      if (!isNaN(parsedDate) && now - parsedDate > ninetyDaysMs) {
        oldCount++;
      }
    }

    const s = item.strengthScore ?? 75;
    sumScore += s;
    if (s >= 70) {
      strongCount++;
    } else {
      weakCount++;
    }
  }

  const avgPasswordScore = Math.round(sumScore / totalVaults);
  const emailVerifiedBonus = Math.round((verifiedCount / totalVaults) * 15);
  const oldPasswordPenalty = Math.min(20, oldCount * 5);

  const rawScore = Math.max(10, Math.min(100, avgPasswordScore + emailVerifiedBonus - oldPasswordPenalty));

  let label = 'Strong Security';
  let color = '#10B981';

  if (rawScore >= 85) {
    label = 'Excellent Security';
    color = '#06B6D4';
  } else if (rawScore >= 70) {
    label = 'Strong Security';
    color = '#10B981';
  } else if (rawScore >= 50) {
    label = 'Fair Security';
    color = '#F59E0B';
  } else {
    label = 'Attention Needed';
    color = '#EF4444';
  }

  return {
    overallScore: rawScore,
    label,
    color,
    totalVaults,
    strongCount,
    weakCount,
    oldCount,
    favoritesCount,
    verifiedCount,
  };
}
