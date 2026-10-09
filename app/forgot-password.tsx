import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '../components/theme-toggle';
import { ThemeColors, useAppTheme } from '../context/theme-context';

export default function ForgotPassword() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <View style={styles.topBar}>
        <ThemeToggle />
      </View>

      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.icon}>🛡️</Text>
        </View>
        <Text style={styles.logo}>
          Secure<Text style={styles.logoAccent}>Vault</Text>
        </Text>
        <Text style={styles.tagline}>&quot;Your Passwords. Your Security.&quot;</Text>
        <Text style={styles.subtitle}>Zero-Knowledge Password Manager</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.icon}>🔐</Text>

        <Text style={styles.heading}>Forgot Password?</Text>

        <Text style={styles.info}>
          Password recovery is temporarily unavailable.
          We'll add phone verification and recovery
          features later.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        Your passwords remain stored in your local vault.
      </Text>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: 24,
    },
    topBar: {
      position: 'absolute',
      top: 50,
      right: 24,
      zIndex: 10,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    logoBadge: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.badgeBg,
      borderWidth: 1,
      borderColor: colors.badgeBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    logo: {
      color: colors.text,
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    logoAccent: {
      color: colors.primary,
    },
    tagline: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    subtitle: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
    },
    icon: {
      fontSize: 42,
      marginBottom: 16,
    },
    heading: {
      color: colors.text,
      fontSize: 23,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 14,
    },
    info: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 23,
      marginBottom: 24,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 10,
      alignItems: 'center',
      width: '100%',
    },
    buttonText: {
      color: colors.primaryText,
      fontWeight: 'bold',
      fontSize: 16,
    },
    footer: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 24,
    },
  });