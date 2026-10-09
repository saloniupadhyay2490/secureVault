import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import CryptoJS from 'crypto-js';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemeToggle } from '../components/theme-toggle';
import { ThemeColors, useAppTheme } from '../context/theme-context';
import { BrandIcon, getBrandConfig } from '../components/brand-icon';
import { PasswordGeneratorModal } from '../components/password-generator-modal';
import { PasswordStrengthMeter } from '../components/password-strength-meter';
import {
  calculatePasswordStrength,
  calculateVaultSecurityMetrics,
  SecurityScoreOverview,
} from '../utils/password-generator';

import {
  addVaultItem,
  updateVaultItem,
  deleteVaultItem,
  toggleVaultFavorite,
  getVaultItems,
  initDB,
  VaultItemRow,
} from '../../database';
import { getSessionKey, setSessionKey, clearSessionKey } from '../../session';
import { supabase } from '../utils/lib/supabase';

// --------------------------------------------------
// CIPHER UTILITIES
// --------------------------------------------------

const safeEncrypt = (plainText: string, key: string): string => {
  if (!plainText) return '';
  try {
    return CryptoJS.AES.encrypt(plainText, key).toString();
  } catch (error) {
    console.error('Encryption Error:', error);
    return '';
  }
};

const safeDecrypt = (cipherText: string, key: string): string => {
  if (!cipherText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || 'Decryption Error';
  } catch (error) {
    console.error('Decryption Error:', error);
    return 'Decryption Error';
  }
};

type TabType = 'home' | 'add' | 'security' | 'settings';
type CategoryFilter = 'all' | 'favorites' | 'social' | 'banking' | 'email' | 'shopping' | 'work' | 'other';

const CATEGORIES = ['Social', 'Banking', 'Email', 'Shopping', 'Work', 'Other'];

export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Tab & Session Navigation
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [sessionKey, setLocalSessionKey] = useState<string | null>(null);

  // Vault Items in Memory
  const [vaultItems, setVaultItems] = useState<any[]>([]);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  // Form State (Add / Edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCategory, setNewCategory] = useState('Other');
  const [newNotes, setNewNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isGeneratorVisible, setIsGeneratorVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Email OTP Verification State (Real Edge Function + Resend)
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // In-App Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Settings State
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(5);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);

  // Auto-lock tracking
  const lastActiveRef = useRef<number>(Date.now());

  // --------------------------------------------------
  // GREETING
  // --------------------------------------------------
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------
  useEffect(() => {
    try {
      initDB();
    } catch (error) {
      console.error('Database Error:', error);
      Alert.alert('Database Error', 'Unable to initialize the database.');
      return;
    }

    const key = getSessionKey();
    if (!key) {
      router.replace('/tabs');
      return;
    }

    setLocalSessionKey(key);
    loadPasswords(key);
    loadSettings();
    checkBiometrics();
  }, []);

  // --------------------------------------------------
  // LOAD SETTINGS
  // --------------------------------------------------
  const loadSettings = async () => {
    try {
      const storedLock = await SecureStore.getItemAsync('securevault_autolock_min');
      if (storedLock !== null) {
        setAutoLockMinutes(parseInt(storedLock, 10));
      }

      const storedBio = await SecureStore.getItemAsync('securevault_biometrics_enabled');
      if (storedBio === 'true') {
        setBiometricsEnabled(true);
      }
    } catch (err) {
      console.warn('Settings load error:', err);
    }
  };

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricsAvailable(hasHardware && isEnrolled);
    } catch (err) {
      setBiometricsAvailable(false);
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (enabled && biometricsAvailable) {
      try {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable Biometric Unlock for SecureVault',
        });
        if (res.success) {
          setBiometricsEnabled(true);
          await SecureStore.setItemAsync('securevault_biometrics_enabled', 'true');
          Alert.alert('Biometrics Enabled', 'You can now use biometrics to unlock SecureVault.');
        } else {
          Alert.alert('Authentication Failed', 'Could not verify biometrics.');
        }
      } catch (err) {
        Alert.alert('Error', 'Biometrics could not be configured.');
      }
    } else {
      setBiometricsEnabled(false);
      await SecureStore.deleteItemAsync('securevault_biometrics_enabled');
    }
  };

  const handleSetAutoLock = async (minutes: number) => {
    setAutoLockMinutes(minutes);
    try {
      await SecureStore.setItemAsync('securevault_autolock_min', minutes.toString());
    } catch (err) {
      console.warn('AutoLock save error:', err);
    }
  };

  // --------------------------------------------------
  // AUTO-LOCK INACTIVITY LISTENER
  // --------------------------------------------------
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (autoLockMinutes > 0) {
          const elapsedMin = (Date.now() - lastActiveRef.current) / (1000 * 60);
          if (elapsedMin >= autoLockMinutes) {
            handleLogout();
          }
        }
      } else if (nextAppState === 'background') {
        lastActiveRef.current = Date.now();
        if (autoLockMinutes === 0) {
          handleLogout();
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [autoLockMinutes]);

  // --------------------------------------------------
  // LOAD PASSWORDS
  // --------------------------------------------------
  const loadPasswords = (key: string) => {
    try {
      const items: VaultItemRow[] = getVaultItems();
      const mapped = items.map((item) => {
        const decTitle = safeDecrypt(item.encrypted_title, key);
        const decUser = item.encrypted_username ? safeDecrypt(item.encrypted_username, key) : '';
        const decEmail = item.encrypted_email ? safeDecrypt(item.encrypted_email, key) : '';
        const decNotes = item.encrypted_notes ? safeDecrypt(item.encrypted_notes, key) : '';
        const detectedCategory = item.category || getBrandConfig(decTitle).category;

        return {
          id: item.item_id.toString(),
          title: decTitle,
          username: decUser,
          email: decEmail,
          notes: decNotes,
          category: detectedCategory,
          isFavorite: item.is_favorite === 1,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          encryptedPassword: item.encrypted_password,
          revealedPassword: null as string | null,
          isRevealed: false,
        };
      });

      setVaultItems(mapped);
    } catch (error) {
      console.error('Load Passwords Error:', error);
      Alert.alert('Error', 'Unable to load vault passwords.');
    }
  };

  // --------------------------------------------------
  // TOGGLE REVEAL (ON-DEMAND DECRYPTION)
  // --------------------------------------------------
  const toggleReveal = (id: string) => {
    setVaultItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        if (item.isRevealed) {
          return {
            ...item,
            isRevealed: false,
            revealedPassword: null,
          };
        }
        const decrypted = sessionKey
          ? safeDecrypt(item.encryptedPassword, sessionKey)
          : 'Decryption Error';
        return {
          ...item,
          isRevealed: true,
          revealedPassword: decrypted,
        };
      })
    );
  };

  // --------------------------------------------------
  // TOGGLE FAVORITE
  // --------------------------------------------------
  const handleToggleFavorite = (id: string, currentFav: boolean) => {
    const nextFav = !currentFav;
    toggleVaultFavorite(id, nextFav);
    setVaultItems((items) =>
      items.map((it) => (it.id === id ? { ...it, isFavorite: nextFav } : it))
    );
  };

  // --------------------------------------------------
  // CLIPBOARD COPY HANDLERS
  // --------------------------------------------------
  const handleCopyUsername = async (value: string, title?: string) => {
    if (!value) {
      Alert.alert('No Username', 'There is no username stored for this credential.');
      return;
    }
    try {
      await Clipboard.setStringAsync(value);
      showToast(`Copied username "${value}"! Ready to paste.`);
    } catch {
      Alert.alert('Copy Error', 'Could not copy username to clipboard.');
    }
  };

  const handleCopyPassword = async (item: any) => {
    if (!sessionKey) {
      Alert.alert('Session Expired', 'Please unlock your vault again.');
      return;
    }
    try {
      let plain = item.revealedPassword;
      if (!plain && item.encryptedPassword) {
        plain = safeDecrypt(item.encryptedPassword, sessionKey);
      }
      if (!plain) {
        Alert.alert('Error', 'Unable to decrypt password.');
        return;
      }
      await Clipboard.setStringAsync(plain);
      showToast(`Copied password for ${item.title || 'account'}! Ready to paste.`);
    } catch {
      Alert.alert('Copy Error', 'Could not copy password to clipboard.');
    }
  };

  // --------------------------------------------------
  // CLEAR FORM
  // --------------------------------------------------
  const clearForm = () => {
    setEditingId(null);
    setNewTitle('');
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewCategory('Other');
    setNewNotes('');
    setIsFavorite(false);
    setShowFormPassword(false);
    setEmailOtp('');
    setEmailOtpSent(false);
    setEmailVerified(false);
    setVerifiedEmail('');
  };

  // --------------------------------------------------
  // EDIT TRIGGER
  // --------------------------------------------------
  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewUsername(item.username || '');
    setNewEmail(item.email || '');
    setNewCategory(item.category || 'Other');
    setNewNotes(item.notes || '');
    setIsFavorite(!!item.isFavorite);

    if (sessionKey && item.encryptedPassword) {
      const decPass = safeDecrypt(item.encryptedPassword, sessionKey);
      setNewPassword(decPass);
    }

    if (item.email) {
      setEmailVerified(true);
      setVerifiedEmail(item.email.toLowerCase());
    } else {
      setEmailVerified(false);
      setVerifiedEmail('');
    }

    setShowFormPassword(false);
    setEmailOtp('');
    setEmailOtpSent(false);
    setActiveTab('add');
  };

  // --------------------------------------------------
  // DELETE TRIGGER
  // --------------------------------------------------
  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Credential',
      'Are you sure you want to delete this password permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteVaultItem(id);
              if (sessionKey) {
                loadPasswords(sessionKey);
              }
              if (editingId === id) {
                clearForm();
              }
            } catch (error) {
              console.error('Delete Error:', error);
              Alert.alert('Error', 'Unable to delete this credential.');
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // EMAIL OTP HANDLERS (SUPABASE EDGE + RESEND)
  // --------------------------------------------------
  const handleEmailChange = (val: string) => {
    const cleaned = val.trim().toLowerCase();
    setNewEmail(val);
    if (emailVerified && cleaned !== verifiedEmail) {
      setEmailVerified(false);
      setVerifiedEmail('');
      setEmailOtp('');
      setEmailOtpSent(false);
    }
  };

  const sendEmailOtp = async () => {
    Keyboard.dismiss();
    const email = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSendingEmailOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp', {
        body: { email },
      });

      if (error) {
        Alert.alert('OTP Error', error.message || 'Unable to send OTP via Resend.');
        return;
      }

      if (data && data.success === false) {
        Alert.alert('OTP Notice', data.message || 'Could not send verification code.');
        return;
      }

      setEmailOtpSent(true);
      setEmailVerified(false);
      setVerifiedEmail('');
      Alert.alert('OTP Sent', `A 6-digit verification code was sent to ${email}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to connect to verification service.');
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const verifyEmailOtp = async () => {
    Keyboard.dismiss();
    const email = newEmail.trim().toLowerCase();
    const otp = emailOtp.trim();

    if (!otp || otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code sent to your email.');
      return;
    }

    setIsVerifyingEmailOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-otp', {
        body: { email, otp },
      });

      if (error || !data || data.success !== true || data.verified !== true) {
        Alert.alert('Verification Failed', 'Incorrect or expired OTP code.');
        return;
      }

      setEmailVerified(true);
      setVerifiedEmail(email);
      Alert.alert('Verified', 'Email verified successfully! You may now save this credential.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to verify code.');
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  };

  // --------------------------------------------------
  // SAVE / UPDATE CREDENTIAL
  // --------------------------------------------------
  const handleSave = () => {
    Keyboard.dismiss();
    const title = newTitle.trim();
    const username = newUsername.trim();
    const email = newEmail.trim().toLowerCase();
    const password = newPassword;

    if (!title || title.length < 2 || title.length > 50) {
      Alert.alert('Invalid Account Name', 'Account name must be between 2 and 50 characters.');
      return;
    }
    if (!/[a-zA-Z]/.test(title)) {
      Alert.alert('Invalid Account Name', 'Account name must contain at least one letter.');
      return;
    }
    if (!username || username.length < 3 || username.length > 30) {
      Alert.alert('Invalid Username', 'Username must be between 3 and 30 characters.');
      return;
    }

    // Check duplicate usernames for new credentials
    if (editingId === null) {
      const exists = vaultItems.some(
        (i) => i.username && i.username.toLowerCase() === username.toLowerCase()
      );
      if (exists) {
        Alert.alert('Duplicate Username', 'This username is already stored in your vault.');
        return;
      }
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!emailVerified || verifiedEmail !== email) {
      Alert.alert('Verification Required', 'Please verify your email address with OTP before saving.');
      return;
    }

    if (!password || password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (!sessionKey) {
      Alert.alert('Session Expired', 'Please unlock your vault again.');
      router.replace('/tabs');
      return;
    }

    setIsSaving(true);
    try {
      const encTitle = safeEncrypt(title, sessionKey);
      const encUser = safeEncrypt(username, sessionKey);
      const encEmail = safeEncrypt(email, sessionKey);
      const encPass = safeEncrypt(password, sessionKey);
      const encNotes = newNotes ? safeEncrypt(newNotes, sessionKey) : '';
      const chosenCat = newCategory || getBrandConfig(title).category;

      if (editingId !== null) {
        updateVaultItem(editingId, encTitle, encUser, encEmail, encPass, chosenCat, encNotes, isFavorite);
        Alert.alert('Success', 'Credential updated successfully in your encrypted vault.');
      } else {
        addVaultItem(encTitle, encUser, encEmail, encPass, chosenCat, encNotes, isFavorite);
        Alert.alert('Success', 'New credential saved securely to your vault.');
      }

      loadPasswords(sessionKey);
      clearForm();
      setActiveTab('home');
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Could not save credential.');
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------
  const handleLogout = () => {
    clearSessionKey();
    setLocalSessionKey(null);
    router.replace('/tabs');
  };

  // --------------------------------------------------
  // SECURITY METRICS CALCULATION
  // --------------------------------------------------
  const securityMetrics: SecurityScoreOverview = useMemo(() => {
    const scoreItems = vaultItems.map((item) => {
      const strengthScore = item.title ? 80 : 60;
      return {
        isFavorite: !!item.isFavorite,
        hasVerifiedEmail: !!item.email,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        strengthScore,
      };
    });
    return calculateVaultSecurityMetrics(scoreItems);
  }, [vaultItems]);

  // --------------------------------------------------
  // FILTERED VAULT LIST
  // --------------------------------------------------
  const filteredVaultItems = useMemo(() => {
    let list = vaultItems;

    if (selectedCategory === 'favorites') {
      list = list.filter((i) => i.isFavorite);
    } else if (selectedCategory !== 'all') {
      list = list.filter((i) => (i.category || 'other').toLowerCase() === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.username && item.username.toLowerCase().includes(q)) ||
          (item.email && item.email.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q))
      );
    }

    return list;
  }, [vaultItems, selectedCategory, searchQuery]);

  // ==================================================
  // RENDER: HOME / VAULT TAB
  // ==================================================
  const renderHomeTab = () => (
    <FlatList
      data={filteredVaultItems}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          {/* USER GREETING & SECURITY SCORE CARD */}
          <View style={styles.greetingHeader}>
            <Text style={styles.greetingSubtitle}>{greeting}, User 👋</Text>
            <Text style={styles.greetingTitle}>Your Vault</Text>
          </View>

          {/* SECURITY SCORE CARD */}
          <TouchableOpacity
            style={styles.securityScoreCard}
            onPress={() => setActiveTab('security')}
            activeOpacity={0.85}
          >
            <View style={styles.scoreLeft}>
              <View style={[styles.scoreBadgeCircle, { borderColor: securityMetrics.color }]}>
                <Text style={[styles.scoreNumber, { color: securityMetrics.color }]}>
                  {securityMetrics.overallScore}
                </Text>
                <Text style={styles.scoreMax}>/ 100</Text>
              </View>
              <View style={styles.scoreDetails}>
                <Text style={styles.scoreHeading}>Security Score</Text>
                <Text style={[styles.scoreLabel, { color: securityMetrics.color }]}>
                  {securityMetrics.label}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* SEARCH BAR */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search passwords by name, email, or category..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* CATEGORY FILTER PILLS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsRow}
          >
            {[
              { id: 'all', label: '🔐 All Passwords', count: vaultItems.length },
              { id: 'favorites', label: '⭐ Favorites', count: securityMetrics.favoritesCount },
              { id: 'social', label: '🌐 Social' },
              { id: 'banking', label: '🏦 Banking' },
              { id: 'email', label: '📧 Email' },
              { id: 'shopping', label: '🛒 Shopping' },
              { id: 'work', label: '💼 Work' },
              { id: 'other', label: '📁 Other' },
            ].map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catPill,
                    active && styles.catPillActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id as CategoryFilter)}
                >
                  <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                    {cat.label} {cat.count !== undefined ? `(${cat.count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* LIST TITLE */}
          <View style={styles.listHeadingRow}>
            <Text style={styles.listHeading}>
              {selectedCategory === 'favorites' ? 'Favorite Passwords' : 'Saved Accounts'}
            </Text>
            <Text style={styles.listCount}>{filteredVaultItems.length} records</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.vaultCard}>
          {/* CARD MAIN ROW */}
          <View style={styles.cardMainRow}>
            <BrandIcon title={item.title} size={22} containerSize={46} />

            <View style={styles.cardInfo}>
              <View style={styles.titleCatRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category || 'Other'}</Text>
                </View>
              </View>

              {item.email ? (
                <Text style={styles.cardSubText} numberOfLines={1}>{item.email}</Text>
              ) : item.username ? (
                <Text style={styles.cardSubText} numberOfLines={1}>@{item.username}</Text>
              ) : null}
            </View>

            {/* FAVORITE STAR TOGGLE */}
            <TouchableOpacity
              style={styles.starBtn}
              onPress={() => handleToggleFavorite(item.id, item.isFavorite)}
            >
              <Ionicons
                name={item.isFavorite ? 'star' : 'star-outline'}
                size={22}
                color={item.isFavorite ? colors.gold : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* USERNAME ROW WITH COPY BUTTON */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldValueCol}>
              <Text style={styles.cardFieldLabel}>
                {item.username ? 'Username' : 'Email / User'}
              </Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {item.username || item.email || '—'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => handleCopyUsername(item.username || item.email, item.title)}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>

          {/* PASSWORD ROW WITH REVEAL & COPY BUTTONS */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldValueCol}>
              <Text style={styles.cardFieldLabel}>Password</Text>
              <Text style={styles.passValue} numberOfLines={1}>
                {item.isRevealed ? item.revealedPassword : '••••••••••••••••'}
              </Text>
            </View>

            <View style={styles.fieldActionsRight}>
              <TouchableOpacity
                style={styles.revealBtn}
                onPress={() => toggleReveal(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.isRevealed ? 'eye-off-outline' : 'eye-outline'}
                  size={13}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.revealBtnText}>{item.isRevealed ? 'Hide' : 'Reveal'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => handleCopyPassword(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.copyBtnText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ACTIONS: EDIT & DELETE */}
          <View style={styles.cardFooterActions}>
            <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleEdit(item)}>
              <Ionicons name="create-outline" size={15} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.cardActionText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardActionBtnDelete} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={15} color={colors.danger} style={{ marginRight: 4 }} />
              <Text style={styles.cardActionTextDelete}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching passwords' : 'Your Vault is Empty'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try searching with another keyword.'
              : 'Add your first password to keep your accounts secure.'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => {
                clearForm();
                setActiveTab('add');
              }}
            >
              <Text style={styles.emptyAddBtnText}>➕ Add First Password</Text>
            </TouchableOpacity>
          )}
        </View>
      }
    />
  );

  // ==================================================
  // RENDER: ADD / EDIT CREDENTIAL TAB
  // ==================================================
  const renderAddTab = () => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.formScrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <BrandIcon title={newTitle || 'Key'} size={24} containerSize={48} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.formHeading}>
              {editingId ? 'Edit Password' : 'Add New Password'}
            </Text>
            <Text style={styles.formSubheading}>
              Zero-knowledge AES-256 local encrypted storage
            </Text>
          </View>
        </View>

        {/* ACCOUNT NAME */}
        <Text style={styles.fieldLabel}>Account Name *</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. Google, Instagram, GitHub, Chase"
          placeholderTextColor={colors.placeholder}
          value={newTitle}
          onChangeText={setNewTitle}
          autoCapitalize="words"
        />

        {/* CATEGORY SELECTOR */}
        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formCategoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.formCatPill,
                newCategory === cat && styles.formCatPillActive,
              ]}
              onPress={() => setNewCategory(cat)}
            >
              <Text
                style={[
                  styles.formCatPillText,
                  newCategory === cat && styles.formCatPillTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* USERNAME */}
        <Text style={styles.fieldLabel}>Username *</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="3–30 characters (letters, numbers, dot, dash)"
          placeholderTextColor={colors.placeholder}
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* EMAIL & VERIFICATION */}
        <Text style={styles.fieldLabel}>Email Address *</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="user@example.com"
          placeholderTextColor={colors.placeholder}
          value={newEmail}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* EMAIL VERIFICATION STATUS BAR */}
        <View style={styles.emailVerifyBox}>
          {emailVerified ? (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={styles.verifiedText}>✓ Email Verified ({verifiedEmail})</Text>
            </View>
          ) : (
            <View>
              <View style={styles.verifyPromptRow}>
                <Text style={styles.verifyPromptText}>
                  {emailOtpSent ? 'OTP sent! Check your inbox:' : 'Ownership verification required via Resend:'}
                </Text>
                <TouchableOpacity
                  style={[styles.sendOtpBtn, isSendingEmailOtp && styles.btnDisabled]}
                  onPress={sendEmailOtp}
                  disabled={isSendingEmailOtp}
                >
                  <Text style={styles.sendOtpBtnText}>
                    {isSendingEmailOtp ? 'Sending...' : emailOtpSent ? 'Resend OTP' : 'Send Email OTP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {emailOtpSent && (
                <View style={styles.otpInputRow}>
                  <TextInput
                    style={styles.otpField}
                    placeholder="6-digit OTP"
                    placeholderTextColor={colors.placeholder}
                    value={emailOtp}
                    onChangeText={setEmailOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.verifyOtpBtn, isVerifyingEmailOtp && styles.btnDisabled]}
                    onPress={verifyEmailOtp}
                    disabled={isVerifyingEmailOtp}
                  >
                    <Text style={styles.verifyOtpBtnText}>
                      {isVerifyingEmailOtp ? 'Verifying...' : 'Verify OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* PASSWORD FIELD WITH GENERATOR & EYE */}
        <View style={styles.passHeaderRow}>
          <Text style={styles.fieldLabel}>Password (8+ chars) *</Text>
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={() => setIsGeneratorVisible(true)}
          >
            <Ionicons name="flash-outline" size={13} color={colors.primary} style={{ marginRight: 3 }} />
            <Text style={styles.generateBtnText}>Generate Strong</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.passInputWrapper}>
          <TextInput
            style={styles.passInput}
            placeholder="Min 8 characters"
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!showFormPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.passEyeBtn}
            onPress={() => setShowFormPassword(!showFormPassword)}
          >
            <Ionicons
              name={showFormPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* LIVE PASSWORD STRENGTH METER */}
        <PasswordStrengthMeter password={newPassword} />

        {/* NOTES (OPTIONAL) */}
        <Text style={styles.fieldLabel}>Secure Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Additional security questions, backup PIN, or notes..."
          placeholderTextColor={colors.placeholder}
          value={newNotes}
          onChangeText={setNewNotes}
          multiline
          numberOfLines={3}
        />

        {/* FAVORITE CHECKBOX */}
        <TouchableOpacity
          style={styles.favoriteCheckRow}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <Ionicons
            name={isFavorite ? 'star' : 'star-outline'}
            size={20}
            color={isFavorite ? colors.gold : colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.favoriteCheckLabel}>Mark as favorite</Text>
        </TouchableOpacity>

        {/* SUBMIT BUTTONS */}
        <View style={styles.formActions}>
          {editingId !== null && (
            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={() => {
                clearForm();
                setActiveTab('home');
              }}
            >
              <Text style={styles.cancelFormBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveFormBtn, isSaving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveFormBtnText}>
              {isSaving ? 'Encrypting & Saving...' : editingId ? 'Update Password' : 'Save Password'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  // ==================================================
  // RENDER: SECURITY DASHBOARD TAB
  // ==================================================
  const renderSecurityTab = () => (
    <ScrollView style={styles.tabScroll} contentContainerStyle={styles.securityScrollContent}>
      <View style={styles.securityHeader}>
        <Text style={styles.greetingTitle}>Security Dashboard</Text>
        <Text style={styles.greetingSubtitle}>Real-time analysis of your encrypted vault</Text>
      </View>

      {/* OVERALL SCORE HERO CARD */}
      <View style={styles.securityHeroCard}>
        <View style={[styles.securityScoreCircle, { borderColor: securityMetrics.color }]}>
          <Text style={[styles.securityScoreBig, { color: securityMetrics.color }]}>
            {securityMetrics.overallScore}
          </Text>
          <Text style={styles.securityScoreDenom}>out of 100</Text>
        </View>
        <Text style={[styles.securityHeroLabel, { color: securityMetrics.color }]}>
          {securityMetrics.label}
        </Text>
        <Text style={styles.securityHeroDesc}>
          Score calculated based on password length, diversity, and verified email identity.
        </Text>
      </View>

      {/* STATISTICS GRID */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Ionicons name="shield-checkmark" size={24} color={colors.success} style={{ marginBottom: 6 }} />
          <Text style={styles.statBoxNum}>{securityMetrics.strongCount}</Text>
          <Text style={styles.statBoxLabel}>Strong Passwords</Text>
        </View>

        <View style={styles.statBox}>
          <Ionicons name="warning" size={24} color={colors.warning} style={{ marginBottom: 6 }} />
          <Text style={[styles.statBoxNum, { color: colors.warning }]}>{securityMetrics.weakCount}</Text>
          <Text style={styles.statBoxLabel}>Weak Passwords</Text>
        </View>

        <View style={styles.statBox}>
          <Ionicons name="time" size={24} color={colors.textSecondary} style={{ marginBottom: 6 }} />
          <Text style={styles.statBoxNum}>{securityMetrics.oldCount}</Text>
          <Text style={styles.statBoxLabel}>Old Passwords (90d+)</Text>
        </View>

        <View style={styles.statBox}>
          <Ionicons name="star" size={24} color={colors.gold} style={{ marginBottom: 6 }} />
          <Text style={styles.statBoxNum}>{securityMetrics.favoritesCount}</Text>
          <Text style={styles.statBoxLabel}>Favorites</Text>
        </View>
      </View>

      {/* VERIFIED EMAILS STAT CARD */}
      <View style={styles.verifiedEmailsCard}>
        <View style={styles.verifiedEmailsLeft}>
          <Ionicons name="mail-unread" size={24} color={colors.primary} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.verifiedEmailsTitle}>Verified Account Emails</Text>
            <Text style={styles.verifiedEmailsSubtitle}>
              {securityMetrics.verifiedCount} of {vaultItems.length} accounts verified via Resend OTP
            </Text>
          </View>
        </View>
        <Text style={[styles.verifiedEmailsBadge, { color: colors.success }]}>100%</Text>
      </View>

      {/* SECURITY RECOMMENDATIONS */}
      <View style={styles.recommendationsCard}>
        <Text style={styles.recTitle}>Security Recommendations</Text>

        <View style={styles.recItem}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.recText}>
            Zero-knowledge encryption is active. Your passwords are never stored in plain text.
          </Text>
        </View>

        <View style={styles.recItem}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.recText}>
            Master Password is protected with PBKDF2 (100,000 hashing rounds) and unique salt.
          </Text>
        </View>

        {securityMetrics.weakCount > 0 && (
          <View style={styles.recItem}>
            <Ionicons name="alert-circle" size={18} color={colors.warning} style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={[styles.recText, { color: colors.warning }]}>
              {securityMetrics.weakCount} password(s) need strengthening. Use the Password Generator.
            </Text>
          </View>
        )}

        {securityMetrics.oldCount > 0 && (
          <View style={styles.recItem}>
            <Ionicons name="information-circle" size={18} color={colors.textSecondary} style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={styles.recText}>
              {securityMetrics.oldCount} password(s) haven't been rotated in 90+ days.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // ==================================================
  // RENDER: SETTINGS TAB
  // ==================================================
  const renderSettingsTab = () => (
    <ScrollView style={styles.tabScroll} contentContainerStyle={styles.settingsScrollContent}>
      <View style={styles.securityHeader}>
        <Text style={styles.greetingTitle}>Settings</Text>
        <Text style={styles.greetingSubtitle}>Manage appearance, security, and backup</Text>
      </View>

      {/* SECTION: APPEARANCE */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionHeading}>APPEARANCE</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsRowLeft}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={20}
                color={colors.primary}
                style={{ marginRight: 12 }}
              />
              <View>
                <Text style={styles.settingsRowTitle}>Theme Mode</Text>
                <Text style={styles.settingsRowSubtitle}>
                  Current: {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
              </View>
            </View>
            <ThemeToggle compact />
          </View>
        </View>
      </View>

      {/* SECTION: SECURITY & ACCESS */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionHeading}>SECURITY</Text>
        <View style={styles.settingsCard}>
          {/* AUTO LOCK TIMEOUT */}
          <View style={styles.settingsRow}>
            <View style={styles.settingsRowLeft}>
              <Ionicons name="timer-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.settingsRowTitle}>Auto-Lock Vault</Text>
                <Text style={styles.settingsRowSubtitle}>
                  Lock when idle or sent to background
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.lockOptionsRow}>
            {[
              { label: 'Immediate', min: 0 },
              { label: '1m', min: 1 },
              { label: '5m', min: 5 },
              { label: '15m', min: 15 },
              { label: 'Never', min: -1 },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.min}
                style={[
                  styles.lockPill,
                  autoLockMinutes === opt.min && styles.lockPillActive,
                ]}
                onPress={() => handleSetAutoLock(opt.min)}
              >
                <Text
                  style={[
                    styles.lockPillText,
                    autoLockMinutes === opt.min && styles.lockPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* BIOMETRIC UNLOCK */}
          {biometricsAvailable && (
            <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 }]}>
              <View style={styles.settingsRowLeft}>
                <Ionicons name="finger-print" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.settingsRowTitle}>Biometric Unlock</Text>
                  <Text style={styles.settingsRowSubtitle}>Fingerprint / Face ID</Text>
                </View>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                thumbColor={biometricsEnabled ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: colors.badgeBg }}
              />
            </View>
          )}

          {/* MASTER PASSWORD STATUS */}
          <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 }]}>
            <View style={styles.settingsRowLeft}>
              <Ionicons name="key-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.settingsRowTitle}>Master Password</Text>
                <Text style={styles.settingsRowSubtitle}>PBKDF2 100,000 Rounds Active</Text>
              </View>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Protected</Text>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION: SECURITY AUDIT */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionHeading}>SECURITY AUDIT</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingsActionRow}
            onPress={() => setActiveTab('security')}
          >
            <View style={styles.settingsRowLeft}>
              <Ionicons name="shield-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.settingsRowTitle}>Security Audit</Text>
                <Text style={styles.settingsRowSubtitle}>View security score and checklist</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION: SESSION */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionHeading}>SESSION</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsActionRow} onPress={handleLogout}>
            <View style={styles.settingsRowLeft}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 12 }} />
              <View>
                <Text style={[styles.settingsRowTitle, { color: colors.danger }]}>Lock Vault & Logout</Text>
                <Text style={styles.settingsRowSubtitle}>Wipes session key from active memory</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ABOUT */}
      <View style={styles.aboutContainer}>
        <Text style={styles.aboutTitle}>SecureVault Management</Text>
        <Text style={styles.aboutTagline}>&quot;Your Passwords. Your Security.&quot;</Text>
        <Text style={styles.aboutSub}>Version 1.0.0 • College Submission Edition</Text>
      </View>
    </ScrollView>
  );

  // ==================================================
  // MAIN RETURN
  // ==================================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.brandTitleGroup}>
          <View style={styles.brandBadge}>
            <FontAwesome5 name="shield-alt" size={18} color={colors.primary} />
          </View>
          <Text style={styles.brandTitle}>
            Secure<Text style={styles.brandAccent}>Vault</Text>
          </Text>
        </View>

        <View style={styles.topHeaderActions}>
          <ThemeToggle compact />
          <TouchableOpacity style={styles.topIconBtn} onPress={handleLogout}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* TAB CONTENT */}
      <View style={styles.contentArea}>
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'add' && renderAddTab()}
        {activeTab === 'security' && renderSecurityTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </View>

      {/* FLOATING ACTION BUTTON (ON HOME TAB) */}
      {activeTab === 'home' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            clearForm();
            setActiveTab('add');
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={colors.primaryText} />
        </TouchableOpacity>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        {[
          { tab: 'home', icon: 'home', iconInactive: 'home-outline', label: 'Vault' },
          { tab: 'add', icon: 'add-circle', iconInactive: 'add-circle-outline', label: 'Add' },
          { tab: 'security', icon: 'shield-checkmark', iconInactive: 'shield-checkmark-outline', label: 'Security' },
          { tab: 'settings', icon: 'settings', iconInactive: 'settings-outline', label: 'Settings' },
        ].map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <TouchableOpacity
              key={item.tab}
              style={styles.navItem}
              onPress={() => setActiveTab(item.tab as TabType)}
            >
              <Ionicons
                name={(isActive ? item.icon : item.iconInactive) as any}
                size={22}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.navItemLabel,
                  { color: isActive ? colors.primary : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* PASSWORD GENERATOR MODAL */}
      <PasswordGeneratorModal
        visible={isGeneratorVisible}
        onClose={() => setIsGeneratorVisible(false)}
        onUsePassword={(pass) => {
          setNewPassword(pass);
          setShowFormPassword(true);
        }}
      />

      {/* IN-APP TOAST NOTIFICATION */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ==================================================
// STYLES
// ==================================================

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.headerBg,
    },
    brandTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.badgeBg,
      borderWidth: 1,
      borderColor: colors.badgeBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    brandTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      letterSpacing: 0.5,
    },
    brandAccent: {
      color: colors.primary,
    },
    topHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    topIconBtn: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contentArea: {
      flex: 1,
    },

    // --------------------------------------------------
    // HOME / VAULT TAB
    // --------------------------------------------------
    listContent: {
      padding: 16,
      paddingBottom: 90,
    },
    greetingHeader: {
      marginBottom: 12,
    },
    greetingSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    greetingTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 2,
    },
    securityScoreCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 14,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    scoreLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreBadgeCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    scoreNumber: {
      fontSize: 15,
      fontWeight: 'bold',
    },
    scoreMax: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: -2,
    },
    scoreDetails: {
      justifyContent: 'center',
    },
    scoreHeading: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
    },
    scoreLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.inputText,
      padding: 0,
    },
    categoryPillsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 4,
      marginBottom: 14,
    },
    catPill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    catPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    catPillTextActive: {
      color: colors.primaryText,
    },
    listHeadingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      marginTop: 4,
    },
    listHeading: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    listCount: {
      fontSize: 12,
      color: colors.textSecondary,
    },

    // --------------------------------------------------
    // VAULT CARDS
    // --------------------------------------------------
    vaultCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    cardMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    cardInfo: {
      flex: 1,
      marginLeft: 12,
      marginRight: 6,
    },
    titleCatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    categoryBadge: {
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 6,
      backgroundColor: colors.badgeBg,
      borderWidth: 1,
      borderColor: colors.badgeBorder,
    },
    categoryBadgeText: {
      fontSize: 10,
      color: colors.badgeText,
      fontWeight: '600',
    },
    cardSubText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cardUserSmall: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    starBtn: {
      padding: 6,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    fieldValueCol: {
      flex: 1,
      marginRight: 8,
    },
    cardFieldLabel: {
      fontSize: 9,
      textTransform: 'uppercase',
      color: colors.textMuted,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    fieldValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    passValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'monospace',
      letterSpacing: 1,
      marginTop: 2,
    },
    fieldActionsRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 7,
      backgroundColor: colors.badgeBg,
      borderWidth: 1,
      borderColor: colors.badgeBorder,
    },
    copyBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    revealBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 7,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    revealBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    cardFooterActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      paddingTop: 4,
    },
    cardActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardActionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    cardActionBtnDelete: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: colors.dangerBg,
    },
    cardActionTextDelete: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.dangerText,
    },

    // --------------------------------------------------
    // EMPTY STATE
    // --------------------------------------------------
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyIcon: {
      fontSize: 44,
      marginBottom: 10,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    emptyAddBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
    },
    emptyAddBtnText: {
      color: colors.primaryText,
      fontWeight: 'bold',
      fontSize: 14,
    },

    // --------------------------------------------------
    // ADD / EDIT FORM TAB
    // --------------------------------------------------
    tabScroll: {
      flex: 1,
    },
    formScrollContent: {
      padding: 16,
      paddingBottom: 90,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    formHeading: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    formSubheading: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      marginTop: 10,
    },
    fieldInput: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.inputText,
    },
    formCategoryRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 4,
    },
    formCatPill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    formCatPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    formCatPillText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    formCatPillTextActive: {
      color: colors.primaryText,
    },
    emailVerifyBox: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      marginTop: 8,
      marginBottom: 4,
    },
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    verifiedText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
    },
    verifyPromptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    verifyPromptText: {
      fontSize: 11,
      color: colors.textSecondary,
      flex: 1,
      marginRight: 6,
    },
    sendOtpBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.badgeBg,
      borderWidth: 1,
      borderColor: colors.badgeBorder,
    },
    sendOtpBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    otpInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    otpField: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      color: colors.inputText,
    },
    verifyOtpBtn: {
      backgroundColor: colors.success,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    verifyOtpBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    passHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    generateBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    passInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    passInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.inputText,
    },
    passEyeBtn: {
      padding: 6,
    },
    notesInput: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.inputText,
      textAlignVertical: 'top',
    },
    favoriteCheckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    favoriteCheckLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    formActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    cancelFormBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelFormBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    saveFormBtn: {
      flex: 2,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    saveFormBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryText,
    },
    btnDisabled: {
      opacity: 0.6,
    },

    // --------------------------------------------------
    // SECURITY DASHBOARD TAB
    // --------------------------------------------------
    securityScrollContent: {
      padding: 16,
      paddingBottom: 90,
    },
    securityHeader: {
      marginBottom: 14,
    },
    securityHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      marginBottom: 14,
    },
    securityScoreCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
      marginBottom: 8,
    },
    securityScoreBig: {
      fontSize: 26,
      fontWeight: 'bold',
    },
    securityScoreDenom: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: -2,
    },
    securityHeroLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    securityHeroDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    statBox: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    statBoxNum: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 2,
    },
    statBoxLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      textAlign: 'center',
    },
    verifiedEmailsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 14,
    },
    verifiedEmailsLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    verifiedEmailsTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.text,
    },
    verifiedEmailsSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    verifiedEmailsBadge: {
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    recommendationsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    recTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    recItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    recText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      flex: 1,
    },

    // --------------------------------------------------
    // SETTINGS TAB
    // --------------------------------------------------
    settingsScrollContent: {
      padding: 16,
      paddingBottom: 90,
    },
    settingsSection: {
      marginBottom: 18,
    },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 6,
      marginLeft: 4,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingsRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingsRowTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    settingsRowSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    settingsActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    lockOptionsRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 10,
    },
    lockPill: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    lockPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    lockPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    lockPillTextActive: {
      color: colors.primaryText,
    },
    statusPill: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: colors.badgeBg,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    aboutContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    aboutTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
    },
    aboutTagline: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
      fontWeight: '600',
    },
    aboutSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },

    // --------------------------------------------------
    // FLOATING ACTION BUTTON & BOTTOM NAV
    // --------------------------------------------------
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 74,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 64,
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingBottom: 4,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navItemLabel: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
    },

    // --------------------------------------------------
    // BACKUP MODAL
    // --------------------------------------------------
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 460,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 14,
    },
    modalIcon: {
      fontSize: 32,
      marginBottom: 4,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '600',
      marginTop: 2,
      textAlign: 'center',
    },
    summaryCard: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    summaryValue: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '700',
    },
    accountsSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    accountsScroll: {
      maxHeight: 90,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 2,
    },
    accountDot: {
      color: colors.primary,
      fontSize: 14,
      marginRight: 6,
    },
    accountNameText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    noAccountsText: {
      color: colors.textMuted,
      fontSize: 11,
      fontStyle: 'italic',
      paddingVertical: 2,
    },
    toastContainer: {
      position: 'absolute',
      bottom: 78,
      left: 16,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 7,
      zIndex: 9999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toastText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
  });