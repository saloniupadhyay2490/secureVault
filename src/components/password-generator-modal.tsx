import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/theme-context';
import {
  generatePassword,
  calculatePasswordStrength,
} from '../utils/password-generator';

interface PasswordGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  onUsePassword: (password: string) => void;
}

export function PasswordGeneratorModal({
  visible,
  onClose,
  onUsePassword,
}: PasswordGeneratorModalProps) {
  const { colors, isDark } = useAppTheme();

  const [length, setLength] = useState<number>(16);
  const [includeUpper, setIncludeUpper] = useState<boolean>(true);
  const [includeLower, setIncludeLower] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerate = () => {
    const pass = generatePassword({
      length,
      uppercase: includeUpper,
      lowercase: includeLower,
      numbers: includeNumbers,
      symbols: includeSymbols,
    });
    setGeneratedPassword(pass);
    setCopied(false);
  };

  useEffect(() => {
    if (visible) {
      handleGenerate();
    }
  }, [visible, length, includeUpper, includeLower, includeNumbers, includeSymbols]);

  const strength = calculatePasswordStrength(generatedPassword);

  const handleCopy = async () => {
    if (!generatedPassword) return;
    await Clipboard.setStringAsync(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (generatedPassword) {
      onUsePassword(generatedPassword);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.iconWrap, { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder }]}>
                <FontAwesome5 name="key" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Password Generator</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* GENERATED PASSWORD DISPLAY BOX */}
          <View style={[styles.passBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text
              style={[styles.passText, { color: colors.text }]}
              numberOfLines={2}
              selectable={true}
            >
              {generatedPassword}
            </Text>
            <View style={styles.passBoxActions}>
              <TouchableOpacity onPress={handleGenerate} style={styles.actionIconBtn}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCopy} style={styles.actionIconBtn}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={copied ? colors.success : colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* STRENGTH BADGE */}
          <View style={styles.strengthRow}>
            <Text style={[styles.strengthLabel, { color: colors.textSecondary }]}>Strength:</Text>
            <View style={[styles.strengthBadge, { backgroundColor: `${strength.color}20`, borderColor: strength.color }]}>
              <Text style={[styles.strengthBadgeText, { color: strength.color }]}>
                {strength.label} ({strength.score}/100)
              </Text>
            </View>
          </View>

          {/* LENGTH SELECTOR */}
          <View style={styles.section}>
            <View style={styles.optionRow}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Password Length</Text>
              <Text style={[styles.lengthValue, { color: colors.primary }]}>{length} chars</Text>
            </View>
            <View style={styles.lengthButtonsRow}>
              {[8, 12, 16, 20, 24, 32].map((len) => (
                <TouchableOpacity
                  key={len}
                  onPress={() => setLength(len)}
                  style={[
                    styles.lenBtn,
                    {
                      backgroundColor: length === len ? colors.primary : colors.surfaceSecondary,
                      borderColor: length === len ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.lenBtnText,
                      { color: length === len ? colors.primaryText : colors.text },
                    ]}
                  >
                    {len}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* TOGGLES */}
          <View style={[styles.optionsCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleText, { color: colors.text }]}>Uppercase (A-Z)</Text>
              <Switch
                value={includeUpper}
                onValueChange={setIncludeUpper}
                thumbColor={includeUpper ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: colors.badgeBg }}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={[styles.toggleText, { color: colors.text }]}>Lowercase (a-z)</Text>
              <Switch
                value={includeLower}
                onValueChange={setIncludeLower}
                thumbColor={includeLower ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: colors.badgeBg }}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={[styles.toggleText, { color: colors.text }]}>Numbers (0-9)</Text>
              <Switch
                value={includeNumbers}
                onValueChange={setIncludeNumbers}
                thumbColor={includeNumbers ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: colors.badgeBg }}
              />
            </View>

            <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.toggleText, { color: colors.text }]}>Symbols (!@#$%^&*)</Text>
              <Switch
                value={includeSymbols}
                onValueChange={setIncludeSymbols}
                thumbColor={includeSymbols ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: colors.badgeBg }}
              />
            </View>
          </View>

          {/* BUTTONS */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleCopy}
              style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
            >
              <Ionicons name="copy-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.btnSecondaryText, { color: colors.text }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="checkmark-sharp" size={16} color={colors.primaryText} style={{ marginRight: 6 }} />
              <Text style={[styles.btnPrimaryText, { color: colors.primaryText }]}>Use Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  passBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  passText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'monospace',
    marginRight: 8,
  },
  passBoxActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  strengthBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  strengthBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  lengthValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  lengthButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  lenBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  lenBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionsCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnPrimary: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
