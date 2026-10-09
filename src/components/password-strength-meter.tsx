import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/theme-context';
import { calculatePasswordStrength } from '../utils/password-generator';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { colors } = useAppTheme();

  if (!password) {
    return null;
  }

  const result = calculatePasswordStrength(password);
  const { score, label, color, rules } = result;

  const checks = [
    { label: '8+ characters', pass: rules.minLength },
    { label: 'Uppercase letter', pass: rules.hasUpper },
    { label: 'Lowercase letter', pass: rules.hasLower },
    { label: 'Number', pass: rules.hasNumber },
    { label: 'Special symbol', pass: rules.hasSymbol },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      {/* HEADER: BAR & LABEL */}
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Security Strength</Text>
        <Text style={[styles.badge, { color }]}>{label} ({score}%)</Text>
      </View>

      {/* MULTI-SEGMENT PROGRESS BAR */}
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.max(8, score)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {/* CHECKLIST */}
      <View style={styles.checklistGrid}>
        {checks.map((c, idx) => (
          <View key={idx} style={styles.checkItem}>
            <Ionicons
              name={c.pass ? 'checkmark-circle' : 'ellipse-outline'}
              size={13}
              color={c.pass ? colors.success : colors.textMuted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.checkLabel,
                { color: c.pass ? colors.text : colors.textMuted },
              ]}
            >
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '45%',
    paddingVertical: 1,
  },
  checkLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
