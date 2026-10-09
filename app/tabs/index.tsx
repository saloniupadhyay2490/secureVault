import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { ThemeToggle } from '../../components/theme-toggle';
import { ThemeColors, useAppTheme } from '../../context/theme-context';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { PasswordStrengthMeter } from '../../components/password-strength-meter';
import { supabase } from '../../utils/lib/supabase';

// Ensure in-app browser auth session closes on redirect
WebBrowser.maybeCompleteAuthSession();

// Existing database / vault imports
import {
  getMasterAuth,
  initDB,
  saveMasterAuth,
} from '../../../database';

import { setSessionKey } from '../../../session';

import {
  createAuthSalt,
  deriveAuthVerifier,
  deriveKeyFromPassword,
} from '../../utils/crypto';

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Screen =
  | 'welcome'
  | 'phone'
  | 'otp'
  | 'password'
  | 'email';

type AuthMode = 'login' | 'register';

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [screen, setScreen] =
    useState<Screen>('welcome');

  const [authMode, setAuthMode] =
    useState<AuthMode>('login');

  const [phone, setPhone] =
    useState('');

  const [otp, setOtp] =
    useState('');

  const [masterPassword, setMasterPassword] =
    useState('');

  const [confirmMasterPassword, setConfirmMasterPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isRegistered, setIsRegistered] =
    useState<boolean | null>(null);

  // Email Auth State
  const [emailAddress, setEmailAddress] =
    useState('');
  const [emailPassword, setEmailPassword] =
    useState('');
  const [emailAuthMode, setEmailAuthMode] =
    useState<'signin' | 'signup'>('signin');
  const [showEmailPassword, setShowEmailPassword] =
    useState(false);

  // --------------------------------------------------
  // DEMO OTP SETTING
  // --------------------------------------------------

  const isDemoPhoneOtp =
    process.env.EXPO_PUBLIC_DEMO_PHONE_OTP === 'true';

  const DEMO_OTP = '123456';

  // --------------------------------------------------
  // INITIALIZE LOCAL VAULT
  // --------------------------------------------------

  const initializeVault = () => {
    try {
      initDB();

      const existingAuth =
        getMasterAuth();

      setIsRegistered(
        existingAuth !== null
      );

      if (existingAuth !== null) {
        setAuthMode('login');
      } else {
        setAuthMode('register');
      }

      return existingAuth !== null;
    } catch (error) {
      console.error(
        'Database Start Error:',
        error
      );

      Alert.alert(
        'Database Error',
        'Unable to initialize the database.'
      );
      return false;
    }
  };

  // --------------------------------------------------
  // DEEP LINK LISTENER (OAuth & Email Verification)
  // --------------------------------------------------

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      if (event.url) {
        handleAuthRedirectUrl(event.url);
      }
    });

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleAuthRedirectUrl(url);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // --------------------------------------------------
  // SELECT LOGIN
  // --------------------------------------------------

  const startLogin = () => {
    setAuthMode('login');
    setPhone('');
    setOtp('');
    setMasterPassword('');
    setScreen('phone');
  };

  // --------------------------------------------------
  // SELECT REGISTER
  // --------------------------------------------------

  const startRegister = () => {
    setAuthMode('register');
    setPhone('');
    setOtp('');
    setMasterPassword('');
    setIsRegistered(false);
    setScreen('phone');
  };

  // --------------------------------------------------
  // NORMALIZE PHONE
  // --------------------------------------------------

  const normalizePhone = (
    value: string
  ) => {
    let cleaned =
      value.replace(/[^\d+]/g, '');

    // India shortcut:
    // 10 digits -> +91
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = `+91${cleaned}`;
    }

    return cleaned;
  };

  // --------------------------------------------------
  // SEND OTP
  // --------------------------------------------------

  const sendOTP = async () => {
    Keyboard.dismiss();

    const normalizedPhone =
      normalizePhone(phone);

    if (!normalizedPhone) {
      Alert.alert(
        'Phone Number',
        'Please enter your mobile number.'
      );
      return;
    }

    if (
      !normalizedPhone.startsWith('+')
    ) {
      Alert.alert(
        'Invalid Number',
        'Please enter your number with country code, e.g. +91XXXXXXXXXX.'
      );
      return;
    }

    setIsLoading(true);

    try {
      // ---------------------------------------------
      // DEMO PHONE OTP MODE
      // ---------------------------------------------

      if (isDemoPhoneOtp) {
        setPhone(normalizedPhone);
        setOtp('');
        setScreen('otp');

        Alert.alert(
          'Demo OTP',
          'For this submission demo, use OTP: 123456'
        );

        return;
      }

      // ---------------------------------------------
      // REAL SUPABASE / VONAGE OTP
      // ---------------------------------------------

      const { error } =
        await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
        });

      if (error) {
        console.error(
          'OTP Error:',
          error
        );

        Alert.alert(
          'OTP Error',
          error.message
        );

        return;
      }

      setPhone(normalizedPhone);
      setOtp('');
      setScreen('otp');

      Alert.alert(
        'OTP Sent',
        'A verification code has been sent to your mobile number.'
      );
    } catch (error) {
      console.error(
        'Send OTP Error:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to send OTP. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------

  const verifyOTP = async () => {
    Keyboard.dismiss();

    if (otp.length !== 6) {
      Alert.alert(
        'Invalid OTP',
        'Please enter the 6-digit OTP.'
      );
      return;
    }

    setIsLoading(true);

    try {
      // ---------------------------------------------
      // DEMO PHONE OTP MODE
      // ---------------------------------------------

      if (isDemoPhoneOtp) {
        if (otp !== DEMO_OTP) {
          Alert.alert(
            'Invalid OTP',
            'Incorrect OTP. Please enter the 6-digit demo OTP.'
          );
          return;
        }

        // Demo OTP successfully verified
        initializeVault();

        setOtp('');
        setScreen('password');

        Alert.alert(
          'Phone Verified',
          'Your phone number has been verified.'
        );

        return;
      }

      // ---------------------------------------------
      // REAL SUPABASE / VONAGE OTP
      // ---------------------------------------------

      const { error } =
        await supabase.auth.verifyOtp({
          phone,
          token: otp,
          type: 'sms',
        });

      if (error) {
        console.error(
          'OTP Verification Error:',
          error
        );

        Alert.alert(
          'Invalid OTP',
          error.message
        );

        return;
      }

      // Real OTP successfully verified
      initializeVault();

      setOtp('');
      setScreen('password');

      Alert.alert(
        'Phone Verified',
        'Your phone number has been verified.'
      );
    } catch (error) {
      console.error(
        'Verify OTP Error:',
        error
      );

      Alert.alert(
        'Verification Error',
        'Unable to verify OTP.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // MASTER PASSWORD
  // --------------------------------------------------

  const handleMasterPassword =
    async () => {
      Keyboard.dismiss();

      if (isLoading) {
        return;
      }

      if (masterPassword.length < 8) {
        Alert.alert(
          'Security Warning',
          'Master Password must be at least 8 characters long.'
        );
        return;
      }

      if (authMode === 'register') {
        if (!confirmMasterPassword) {
          Alert.alert(
            'Confirm Password',
            'Please confirm your Master Password.'
          );
          return;
        }

        if (masterPassword !== confirmMasterPassword) {
          Alert.alert(
            'Password Mismatch',
            'Master Password and Confirm Password do not match. Please re-enter.'
          );
          return;
        }
      }

      setIsLoading(true);

      try {
        const auth =
          getMasterAuth();

        const keyString =
          deriveKeyFromPassword(
            masterPassword
          );

        if (
          !keyString ||
          keyString.length !== 44
        ) {
          throw new Error(
            'Unable to derive the vault key.'
          );
        }

        // ------------------------------------------------
        // REGISTER
        // ------------------------------------------------

        if (
          authMode === 'register'
        ) {
          // Prevent accidental overwrite
          // if a vault already exists.
          if (auth) {
            Alert.alert(
              'Vault Already Exists',
              'A SecureVault already exists on this device. Please use Login instead.'
            );

            setIsLoading(false);
            return;
          }

          const salt =
            await createAuthSalt();

          const verifier =
            deriveAuthVerifier(
              masterPassword,
              salt
            );

          saveMasterAuth(
            salt,
            verifier
          );
        }

        // ------------------------------------------------
        // LOGIN
        // ------------------------------------------------

        else {
          if (!auth) {
            Alert.alert(
              'No Vault Found',
              'No SecureVault was found on this device. Please select Register to create one.'
            );

            setIsLoading(false);
            return;
          }

          const enteredVerifier =
            deriveAuthVerifier(
              masterPassword,
              auth.salt
            );

          if (
            enteredVerifier !==
            auth.verifier
          ) {
            Alert.alert(
              'Incorrect Password',
              'Your master password is incorrect.'
            );

            setIsLoading(false);
            return;
          }
        }

        // Save vault session key
        setSessionKey(
          keyString
        );

        setMasterPassword('');

        // Open dashboard
        router.replace(
          '/dashboard'
        );
      } catch (error) {
        console.error(
          'Master Password Error:',
          error
        );

        Alert.alert(
          'System Error',
          'Unable to process your master password. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    };

  // --------------------------------------------------
  // BACK TO WELCOME
  // --------------------------------------------------

  const goBackToWelcome = () => {
    if (isLoading) {
      return;
    }

    setPhone('');
    setOtp('');
    setMasterPassword('');
    setEmailAddress('');
    setEmailPassword('');
    setScreen('welcome');
  };

  // --------------------------------------------------
  // BACK TO PHONE
  // --------------------------------------------------

  const goBackToPhone = () => {
    if (isLoading) {
      return;
    }

    setOtp('');
    setScreen('phone');
  };

  // --------------------------------------------------
  // SUPABASE AUTH SUCCESS HANDLER
  // --------------------------------------------------

  const onSupabaseAuthSuccess = (user?: any) => {
    const hasExistingVault = initializeVault();
    setScreen('password');
    setMasterPassword('');
    setConfirmMasterPassword('');

    const userEmail =
      user?.email ||
      user?.user_metadata?.email ||
      'User';

    Alert.alert(
      'Identity Verified',
      hasExistingVault
        ? `Welcome, ${userEmail}! Please enter your Master Password to unlock your encrypted vault.`
        : `Welcome, ${userEmail}! Please create a Master Password to secure your new local vault.`
    );
  };

  // --------------------------------------------------
  // HANDLE OAUTH & EMAIL CONFIRMATION REDIRECT URL
  // --------------------------------------------------

  const handleAuthRedirectUrl = async (urlStr: string) => {
    if (!urlStr) return;

    try {
      setIsLoading(true);

      // 1. Check for error parameters in callback URL
      const parsed = Linking.parse(urlStr);
      const authError =
        parsed.queryParams?.error_description ||
        parsed.queryParams?.error;
      if (authError && typeof authError === 'string') {
        Alert.alert(
          'Sign-In Notice',
          decodeURIComponent(authError.replace(/\+/g, ' '))
        );
        return;
      }

      // 2. Check for PKCE 'code' in query params
      const code = parsed.queryParams?.code;
      if (code && typeof code === 'string') {
        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('exchangeCodeForSession error:', error);
          Alert.alert('Authentication Error', error.message);
          return;
        }
        if (data.session?.user) {
          onSupabaseAuthSuccess(data.session.user);
          return;
        }
      }

      // 3. Check for hash parameters (#access_token=...&refresh_token=...)
      const hashIndex = urlStr.indexOf('#');
      if (hashIndex !== -1) {
        const hash = urlStr.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { data, error } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          if (error) {
            console.error('setSession error:', error);
            Alert.alert('Authentication Error', error.message);
            return;
          }
          if (data.session?.user) {
            onSupabaseAuthSuccess(data.session.user);
            return;
          }
        }
      }

      // 4. Fallback: check if session is already active in Supabase
      const { data: currentSession } =
        await supabase.auth.getSession();
      if (currentSession?.session?.user) {
        onSupabaseAuthSuccess(currentSession.session.user);
      }
    } catch (err: any) {
      console.error('Auth redirect parsing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // REAL SUPABASE GOOGLE OAUTH
  // --------------------------------------------------

  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const redirectUrl = Linking.createURL('auth/callback');

      const { data, error } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

      if (error) {
        Alert.alert('Google Sign-In Error', error.message);
        return;
      }

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (res.type === 'success' && res.url) {
          await handleAuthRedirectUrl(res.url);
        } else if (res.type === 'cancel' || res.type === 'dismiss') {
          // Check if session was completed in background or deep linked
          const { data: currentSession } =
            await supabase.auth.getSession();
          if (currentSession?.session?.user) {
            onSupabaseAuthSuccess(currentSession.session.user);
          }
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      Alert.alert(
        'Google Sign-In Error',
        err?.message || 'Could not complete Google Sign-In. Please check your network connection.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // EMAIL SIGN IN / SIGN UP HANDLERS
  // --------------------------------------------------

  const handleEmailSignIn = () => {
    setEmailAddress('');
    setEmailPassword('');
    setEmailAuthMode('signin');
    setScreen('email');
  };

  const handleEmailSignInSubmit = async () => {
    Keyboard.dismiss();

    const cleanEmail = emailAddress.trim();
    if (!cleanEmail || !emailPassword) {
      Alert.alert('Missing Information', 'Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: emailPassword,
        });

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          Alert.alert(
            'Email Not Verified',
            'Your email address has not been confirmed yet. Would you like to resend the verification email?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Resend Verification',
                onPress: async () => {
                  const { error: resendErr } =
                    await supabase.auth.resend({
                      type: 'signup',
                      email: cleanEmail,
                    });
                  if (resendErr) {
                    Alert.alert('Error', resendErr.message);
                  } else {
                    Alert.alert('Email Sent', 'Verification email has been resent to your inbox.');
                  }
                },
              },
            ]
          );
          return;
        }

        Alert.alert('Sign-In Error', error.message);
        return;
      }

      if (data.session?.user) {
        setEmailPassword('');
        onSupabaseAuthSuccess(data.session.user);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUpSubmit = async () => {
    Keyboard.dismiss();

    const cleanEmail = emailAddress.trim();
    if (!cleanEmail || !emailPassword) {
      Alert.alert('Missing Information', 'Please enter your email and password.');
      return;
    }

    if (emailPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = Linking.createURL('auth/callback');

      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password: emailPassword,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

      if (error) {
        Alert.alert('Sign-Up Error', error.message);
        return;
      }

      if (data.session) {
        // Auto-confirmed by Supabase
        setEmailPassword('');
        onSupabaseAuthSuccess(data.session.user);
      } else if (data.user) {
        // Confirmation email required
        Alert.alert(
          'Verification Email Sent',
          `A verification link has been sent to ${cleanEmail}. Please check your inbox and verify your email, then return here to sign in.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setEmailAuthMode('signin');
                setEmailPassword('');
              },
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to register account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = emailAddress.trim();
    if (!cleanEmail) {
      Alert.alert('Enter Email', 'Please enter your email address to receive password reset instructions.');
      return;
    }

    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: redirectUrl }
      );

      if (error) {
        Alert.alert('Reset Error', error.message);
      } else {
        Alert.alert(
          'Email Sent',
          `Password reset instructions have been sent to ${cleanEmail}.`
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to send reset email.');
    }
  };

  // --------------------------------------------------
  // EMAIL AUTH STEP UI
  // --------------------------------------------------

  const renderEmailStep = () => {
    const isSignIn = emailAuthMode === 'signin';

    return (
      <>
        <Text style={styles.formTitle}>
          {isSignIn ? 'Sign In with Email' : 'Create Account with Email'}
        </Text>

        <Text style={styles.helpText}>
          {isSignIn
            ? 'Sign in to verify your identity with your registered email.'
            : 'Register a new account. A verification link will be sent to your email.'}
        </Text>

        {/* TOGGLE TABS: SIGN IN / SIGN UP */}
        <View style={styles.authModeTabRow}>
          <TouchableOpacity
            style={[
              styles.authModeTab,
              isSignIn && styles.authModeTabActive,
            ]}
            onPress={() => setEmailAuthMode('signin')}
            disabled={isLoading}
          >
            <Text
              style={[
                styles.authModeTabText,
                isSignIn && styles.authModeTabTextActive,
              ]}
            >
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.authModeTab,
              !isSignIn && styles.authModeTabActive,
            ]}
            onPress={() => setEmailAuthMode('signup')}
            disabled={isLoading}
          >
            <Text
              style={[
                styles.authModeTabText,
                !isSignIn && styles.authModeTabTextActive,
              ]}
            >
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          placeholderTextColor={colors.placeholder}
          value={emailAddress}
          onChangeText={setEmailAddress}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder={isSignIn ? 'Enter password' : 'Create password (min 6 chars)'}
            placeholderTextColor={colors.placeholder}
            value={emailPassword}
            onChangeText={setEmailPassword}
            secureTextEntry={!showEmailPassword}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowEmailPassword((prev) => !prev)}
          >
            <Ionicons
              name={showEmailPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={isSignIn ? handleEmailSignInSubmit : handleEmailSignUpSubmit}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading
              ? 'Please wait...'
              : isSignIn
                ? 'Sign In with Email'
                : 'Create Account'}
          </Text>
        </TouchableOpacity>

        {isSignIn && (
          <TouchableOpacity
            style={styles.forgotButton}
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            <Text style={styles.forgotText}>Forgot Email Password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={goBackToWelcome}
          disabled={isLoading}
        >
          <Text style={styles.secondaryText}>← Back to Options</Text>
        </TouchableOpacity>
      </>
    );
  };

  // --------------------------------------------------
  // WELCOME SCREEN
  // --------------------------------------------------

  const renderWelcomeStep = () => {
    return (
      <>
        <Text style={styles.formTitle}>
          Welcome Back
        </Text>

        <Text style={styles.welcomeText}>
          Sign in to access your vault with secure zero-knowledge encryption.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={startLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            Login with Phone
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={startRegister}
          disabled={isLoading}
        >
          <Text style={styles.registerButtonText}>
            Register New Account
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  // --------------------------------------------------
  // PHONE SCREEN
  // --------------------------------------------------

  const renderPhoneStep = () => {
    const isLogin =
      authMode === 'login';

    return (
      <>
        <Text
          style={styles.formTitle}
        >
          {isLogin
            ? 'Login to SecureVault'
            : 'Create Your Account'}
        </Text>

        <Text
          style={styles.label}
        >
          Mobile Number
        </Text>

        <TextInput
          style={styles.input}
          placeholder="+91XXXXXXXXXX"
          placeholderTextColor={colors.placeholder}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        <Text
          style={styles.helpText}
        >
          {isLogin
            ? 'Enter your registered mobile number to receive a verification OTP.'
            : 'Enter your mobile number to create your SecureVault account.'}
        </Text>

        <TouchableOpacity
          style={[
            styles.button,
            isLoading &&
              styles.buttonDisabled,
          ]}
          onPress={sendOTP}
          disabled={isLoading}
        >
          <Text
            style={styles.buttonText}
          >
            {isLoading
              ? 'Sending OTP...'
              : 'Send OTP'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.secondaryButton
          }
          onPress={
            goBackToWelcome
          }
          disabled={isLoading}
        >
          <Text
            style={
              styles.secondaryText
            }
          >
            ← Back
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  // --------------------------------------------------
  // OTP SCREEN
  // --------------------------------------------------

  const renderOtpStep = () => {
    return (
      <>
        <Text
          style={styles.formTitle}
        >
          Verify Mobile Number
        </Text>

        <Text
          style={styles.label}
        >
          Enter OTP
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter OTP"
          placeholderTextColor={colors.placeholder}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          editable={!isLoading}
        />

        <Text
          style={styles.helpText}
        >
          {isDemoPhoneOtp
            ? 'Demo OTP: 123456'
            : `OTP sent to ${phone}`}
        </Text>

        <TouchableOpacity
          style={[
            styles.button,
            isLoading &&
              styles.buttonDisabled,
          ]}
          onPress={verifyOTP}
          disabled={isLoading}
        >
          <Text
            style={styles.buttonText}
          >
            {isLoading
              ? 'Verifying...'
              : 'Verify OTP'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.secondaryButton
          }
          onPress={
            goBackToPhone
          }
          disabled={isLoading}
        >
          <Text
            style={
              styles.secondaryText
            }
          >
            Change Phone Number
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  // --------------------------------------------------
  // PASSWORD SCREEN
  // --------------------------------------------------

  const renderPasswordStep =
    () => {
      const isRegister =
        authMode === 'register';

      return (
        <>
          <Text
            style={styles.formTitle}
          >
            {isRegister
              ? 'Create Master Password'
              : 'Unlock Your Vault'}
          </Text>

          <Text
            style={styles.label}
          >
            Master Password
          </Text>

          <View
            style={
              styles.passwordContainer
            }
          >
            <TextInput
              style={
                styles.passwordInput
              }
              placeholder="Enter your Master Password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={
                !showPassword
              }
              value={
                masterPassword
              }
              onChangeText={
                setMasterPassword
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />

            <TouchableOpacity
              style={
                styles.eyeButton
              }
              onPress={() =>
                setShowPassword(
                  !showPassword
                )
              }
              disabled={isLoading}
            >
              <Text
                style={
                  styles.eyeText
                }
              >
                {showPassword
                  ? '👁 Hide'
                  : '👁 Show'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* PASSWORD STRENGTH METER */}
          {isRegister && masterPassword.length > 0 ? (
            <PasswordStrengthMeter password={masterPassword} />
          ) : null}

          {/* CONFIRM MASTER PASSWORD FOR REGISTER */}
          {isRegister && (
            <>
              <Text
                style={[styles.label, { marginTop: 12 }]}
              >
                Confirm Master Password
              </Text>

              <View
                style={
                  styles.passwordContainer
                }
              >
                <TextInput
                  style={
                    styles.passwordInput
                  }
                  placeholder="Re-enter your Master Password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={
                    !showConfirmPassword
                  }
                  value={
                    confirmMasterPassword
                  }
                  onChangeText={
                    setConfirmMasterPassword
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />

                <TouchableOpacity
                  style={
                    styles.eyeButton
                  }
                  onPress={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  disabled={isLoading}
                >
                  <Text
                    style={
                      styles.eyeText
                    }
                  >
                    {showConfirmPassword
                      ? '👁 Hide'
                      : '👁 Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <Text
            style={styles.helpText}
          >
            {isRegister
              ? 'Choose at least 8 characters with a mix of letters, numbers, and symbols. Remember your password; it cannot be recovered.'
              : 'Enter your master password to unlock your vault.'}
          </Text>

          <TouchableOpacity
            style={[
              styles.button,
              isLoading &&
                styles.buttonDisabled,
            ]}
            onPress={
              handleMasterPassword
            }
            disabled={isLoading}
          >
            <Text
              style={
                styles.buttonText
              }
            >
              {isLoading
                ? 'Please wait...'
                : isRegister
                  ? 'Create & Unlock'
                  : 'Unlock Vault'}
            </Text>
          </TouchableOpacity>
        </>
      );
    };

  // --------------------------------------------------
  // MAIN SCREEN
  // --------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar style={colors.statusBar} />

      {/* TOP BAR / THEME TOGGLE */}
      <View style={styles.topBar}>
        <ThemeToggle />
      </View>

      {/* HEADER */}
      <View
        style={
          styles.headerContainer
        }
      >
        <View style={styles.logoBadge}>
          <FontAwesome5 name="shield-alt" size={32} color={colors.primary} />
        </View>

        <Text
          style={styles.title}
        >
          Secure<Text style={styles.highlight}>Vault</Text>
        </Text>

        <Text style={styles.tagline}>
          &quot;Your Passwords. Your Security.&quot;
        </Text>

        <Text
          style={styles.subtitle}
        >
          Zero-Knowledge AES-256 Encrypted Vault
        </Text>
      </View>

      {/* FORM */}
      <View
        style={
          styles.formContainer
        }
      >
        {screen === 'welcome' &&
          renderWelcomeStep()}

        {screen === 'phone' &&
          renderPhoneStep()}

        {screen === 'otp' &&
          renderOtpStep()}

        {screen === 'password' &&
          renderPasswordStep()}

        {screen === 'email' &&
          renderEmailStep()}
      </View>
    </SafeAreaView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

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

    headerContainer: {
      alignItems: 'center',
      marginBottom: 32,
    },

    title: {
      fontSize: 42,
      fontWeight: 'bold',
      color: colors.text,
      letterSpacing: 2,
    },

    highlight: {
      color: colors.primary,
    },

    tagline: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 4,
      textAlign: 'center',
      letterSpacing: 0.5,
    },

    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },

    formContainer: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },

    formTitle: {
      color: colors.text,
      fontSize: 21,
      fontWeight: 'bold',
      marginBottom: 24,
      textAlign: 'center',
    },

    welcomeText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginBottom: 20,
    },

    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },

    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 16,
      color: colors.inputText,
      fontSize: 16,
      marginBottom: 12,
    },

    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      marginBottom: 12,
    },

    passwordInput: {
      flex: 1,
      padding: 16,
      color: colors.inputText,
      fontSize: 16,
    },

    eyeButton: {
      padding: 16,
    },

    eyeText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: 'bold',
    },

    helpText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 16,
    },

    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    buttonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: 'bold',
    },

    registerButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 14,
    },

    registerButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: 'bold',
    },

    secondaryButton: {
      alignItems: 'center',
      marginTop: 18,
      paddingVertical: 8,
    },

    secondaryText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },

    logoBadge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.badgeBg,
      borderWidth: 1.5,
      borderColor: colors.badgeBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },

    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 18,
    },

    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },

    dividerText: {
      marginHorizontal: 12,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 13,
      marginBottom: 10,
    },

    socialIcon: {
      marginRight: 10,
    },

    socialButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },

    forgotButton: {
      alignItems: 'center',
      marginTop: 22,
      paddingVertical: 8,
    },

    forgotText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },

    authModeTabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      padding: 4,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },

    authModeTab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
    },

    authModeTabActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },

    authModeTabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    authModeTabTextActive: {
      color: colors.primary,
    },
  });