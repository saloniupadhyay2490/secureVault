import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme as useDeviceColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  surface: string;
  surfaceSecondary: string;
  card: string;
  cardBorder: string;
  border: string;
  borderHighlight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryText: string;
  danger: string;
  dangerBg: string;
  dangerText: string;
  warning: string;
  warningBg: string;
  warningText: string;
  success: string;
  successBg: string;
  successText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  gold: string;
  headerBg: string;
  statusBar: 'light' | 'dark';
}

export const darkColors: ThemeColors = {
  isDark: true,
  background: '#050B14',
  backgroundElement: '#0F2038',
  backgroundSelected: '#1E293B',
  surface: '#0A1526',
  surfaceSecondary: '#0F2038',
  card: '#0A1526',
  cardBorder: 'rgba(6, 182, 212, 0.25)',
  border: '#334155',
  borderHighlight: '#06B6D4',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  inputBg: '#050B14',
  inputBorder: '#334155',
  inputText: '#FFFFFF',
  placeholder: '#475569',
  primary: '#06B6D4',
  primaryDark: '#0891B2',
  primaryLight: '#22D3EE',
  primaryText: '#050B14',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  dangerText: '#FCA5A5',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.15)',
  warningText: '#FCD34D',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  successText: '#6EE7B7',
  badgeBg: 'rgba(6, 182, 212, 0.12)',
  badgeBorder: 'rgba(6, 182, 212, 0.3)',
  badgeText: '#06B6D4',
  gold: '#F59E0B',
  headerBg: '#050B14',
  statusBar: 'light',
};

export const lightColors: ThemeColors = {
  isDark: false,
  background: '#F1F5F9',
  backgroundElement: '#E2E8F0',
  backgroundSelected: '#CBD5E1',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  card: '#FFFFFF',
  cardBorder: '#CBD5E1',
  border: '#CBD5E1',
  borderHighlight: '#0891B2',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  inputBg: '#FFFFFF',
  inputBorder: '#94A3B8',
  inputText: '#0F172A',
  placeholder: '#64748B',
  primary: '#0891B2',
  primaryDark: '#0E7490',
  primaryLight: '#06B6D4',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
  dangerBg: 'rgba(220, 38, 38, 0.1)',
  dangerText: '#DC2626',
  warning: '#D97706',
  warningBg: 'rgba(217, 119, 6, 0.12)',
  warningText: '#B45309',
  success: '#059669',
  successBg: 'rgba(5, 150, 105, 0.12)',
  successText: '#059669',
  badgeBg: 'rgba(8, 145, 178, 0.12)',
  badgeBorder: 'rgba(8, 145, 178, 0.35)',
  badgeText: '#0891B2',
  gold: '#D97706',
  headerBg: '#F1F5F9',
  statusBar: 'dark',
};

const STORAGE_KEY = 'securevault_theme_mode';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useDeviceColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        let stored: string | null = null;
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.localStorage) {
            stored = window.localStorage.getItem(STORAGE_KEY);
          }
        } else {
          stored = await SecureStore.getItemAsync(STORAGE_KEY);
        }

        if (stored === 'light' || stored === 'dark') {
          setThemeState(stored);
        } else if (deviceColorScheme === 'light') {
          setThemeState('light');
        } else {
          setThemeState('dark');
        }
      } catch (err) {
        console.warn('Could not load stored theme preference:', err);
      } finally {
        setIsLoaded(true);
      }
    };

    loadTheme();
  }, [deviceColorScheme]);

  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, mode);
        }
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, mode);
      }
    } catch (err) {
      console.warn('Could not persist theme preference:', err);
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        colors,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextType => useContext(ThemeContext);
