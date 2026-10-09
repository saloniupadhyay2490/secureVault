import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';

import 'react-native-get-random-values';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppThemeProvider, useAppTheme } from '@/context/theme-context';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'tabs',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isDark } = useAppTheme();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack
        initialRouteName="tabs"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="tabs"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="dashboard"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="forgot-password"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutNav />
    </AppThemeProvider>
  );
}