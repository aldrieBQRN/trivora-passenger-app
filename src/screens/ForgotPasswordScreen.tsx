import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { COLORS, RADIUS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { passengerApi } from '../services/api';
import Button from '../components/Button';

interface ForgotPasswordScreenProps {
  initialEmail?: string;
  onBack: () => void;
}

type Step = 'email' | 'code' | 'password';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const RESEND_SECONDS = 60;

/** Pulls the server's message out of a failed request, or a connection fallback. */
function errorMessage(err: any): string {
  if (err?.status !== undefined) return err.message || 'Something went wrong. Please try again.';
  return 'Unable to reach Trivora. Please check your internet connection and try again.';
}

/**
 * Forgot password by emailed 6-digit code: enter email -> enter code -> choose a new password.
 * The backend checks that the email is registered before sending.
 */
export default function ForgotPasswordScreen({ initialEmail = '', onBack }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async (isResend = false) => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await passengerApi.forgotPassword(trimmed);
      setResendIn(RESEND_SECONDS);
      setInfo(isResend ? 'A new code has been sent to your email.' : null);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await passengerApi.verifyResetCode(email.trim(), code);
      setStep('password');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (confirmPassword !== password) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await passengerApi.resetPassword(email.trim(), code, password);
      setLoading(false);
      Alert.alert('Password Reset', 'Your password has been reset. You can now log in with your new password.');
      onBack();
    } catch (err: any) {
      setLoading(false);
      setError(errorMessage(err));
    }
  };

  const goBack = () => {
    setError(null);
    setInfo(null);
    if (step === 'password') setStep('code');
    else if (step === 'code') setStep('email');
    else onBack();
  };

  const titles: Record<Step, { title: string; subtitle: string }> = {
    email: {
      title: 'Forgot password?',
      subtitle: "Enter your account's email address and we'll send you a 6-digit code.",
    },
    code: {
      title: 'Check your email',
      subtitle: `Enter the 6-digit code we sent to ${email.trim()}. It expires in 10 minutes.`,
    },
    password: {
      title: 'Set a new password',
      subtitle: 'Choose a new password for your account.',
    },
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={goBack} disabled={loading} activeOpacity={0.7}>
            <ArrowLeft size={18} color={COLORS.textPrimary} />
            <Text style={styles.backText}>{step === 'email' ? 'Back to Log In' : 'Back'}</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <KeyRound size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{titles[step].title}</Text>
          <Text style={styles.subtitle}>{titles[step].subtitle}</Text>

          {info ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}

          {step === 'email' && (
            <>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[styles.fieldBox, error && styles.fieldBoxError]}>
                <Mail size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Email address"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={styles.fieldLabel}>6-digit code</Text>
              <View style={[styles.fieldBox, error && styles.fieldBoxError]}>
                <TextInput
                  style={[styles.fieldInput, styles.codeInput]}
                  placeholder="••••••"
                  placeholderTextColor={COLORS.textMuted}
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.replace(/\D/g, '').slice(0, 6));
                    if (error) setError(null);
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  editable={!loading}
                />
              </View>
            </>
          )}

          {step === 'password' && (
            <>
              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={[styles.fieldBox, error && styles.fieldBoxError]}>
                <Lock size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="New password"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
                  {showPassword ? (
                    <EyeOff size={18} color={COLORS.textSecondary} />
                  ) : (
                    <Eye size={18} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <View style={[styles.fieldBox, error && styles.fieldBoxError]}>
                <Lock size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Confirm new password"
                  placeholderTextColor={COLORS.textMuted}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.ctaSpacing}>
            {step === 'email' && <Button label="Send Code" onPress={() => sendCode()} loading={loading} />}
            {step === 'code' && <Button label="Verify Code" onPress={verifyCode} loading={loading} />}
            {step === 'password' && <Button label="Reset Password" onPress={resetPassword} loading={loading} />}
          </View>

          {step === 'code' && (
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Didn't get the code? </Text>
              {resendIn > 0 ? (
                <Text style={styles.footerText}>Resend in {resendIn}s</Text>
              ) : (
                <TouchableOpacity onPress={() => sendCode(true)} disabled={loading}>
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  backText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  infoBox: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  infoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.emerald,
  },
  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: BUTTONS.touchHeight,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  fieldBoxError: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  fieldInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  codeInput: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    letterSpacing: 8,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.dangerDark,
    marginBottom: SPACING.sm,
    marginLeft: 2,
  },
  ctaSpacing: {
    marginTop: SPACING.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  linkText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
