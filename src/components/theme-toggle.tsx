import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../context/theme-context';

interface ThemeToggleProps {
  style?: object;
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ style, compact = false }) => {
  const { isDark, toggleTheme, colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(226, 232, 240, 0.9)',
          borderColor: isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(8, 145, 178, 0.4)',
        },
        style,
      ]}
      onPress={toggleTheme}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
    >
      <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
      {!compact && (
        <Text
          style={[
            styles.label,
            { color: isDark ? '#22D3EE' : '#0891B2' },
          ]}
        >
          {isDark ? 'Light' : 'Dark'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
