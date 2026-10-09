import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('SUPABASE URL USED BY APP:', supabaseUrl);
console.log(
  'SUPABASE KEY CHECK:',
  supabaseKey
    ? `loaded, starts with ${supabaseKey.substring(0, 14)}...`
    : 'MISSING'
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env file.'
  );
}

// SecureStore adapter for reliable Supabase session persistence
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);