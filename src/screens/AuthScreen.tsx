import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { User, Mail, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { GoogleIcon } from '../components/icons';
import { passengerApi, mapAuthResponseToUserProfile } from '../services/api';
import Button from '../components/Button';
import LegalDocumentModal from '../components/LegalDocumentModal';
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS, PRIVACY_SECTIONS } from '../constants/legalDocuments';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

const DEMO_PASSENGER: UserProfile = {
  id: 1,
  name: 'Maria Santos',
  email: 'maria.santos@trivora.ph',
  mobile: '+63 917 555 0192',
  rating: 4.95,
  totalRides: 28,
  emergencyContact: {
    name: 'Juan Santos (Husband)',
    phone: '+63 918 555 9812',
  },
};

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidMobile(value: string): boolean {
  return digitsOnly(value).length >= 10;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // Consent is never pre-checked or assumed — the passenger must explicitly tap it.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Onboarding's last slide is a dark full-bleed photo; this screen is plain white — the
  // biggest color jump in the whole Splash->Onboarding->Login flow. A quick fade-in (same
  // technique as SplashScreen) softens that handoff instead of an instant white pop.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fade]);

  const switchMode = (register: boolean) => {
    setIsRegister(register);
    setErrors({});
    setAgreedToTerms(false);
  };

  const runAuth = (profile: UserProfile) => {
    setLoading(true);
    // Brief, real loading state — this app has no live auth backend to await,
    // but the transition should still feel like something is happening.
    setTimeout(() => {
      login(profile);
      setLoading(false);
      onAuthenticated();
    }, 700);
  };

  // There's no password-reset endpoint in the backend, so this doesn't pretend to send a reset
  // link — it points to the same real support contact already shown on the Profile screen.
  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password?',
      'For assistance, contact the Trivora Help Center at (043) 931-5678 or support@trivora-nasugbu.gov.ph.'
    );
  };

  const handleContinue = () => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) nextErrors.email = 'Email address is required.';
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address.';

    if (isRegister) {
      if (fullName.trim().length < 2) nextErrors.name = 'Enter your full name.';
      if (!isValidMobile(phoneNumber)) nextErrors.phone = 'Enter a valid 10-digit mobile number.';
      if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
      if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.';
      if (!agreedToTerms) {
        nextErrors.terms = 'Please agree to the Terms & Conditions and Privacy Policy to continue.';
      }
    } else {
      if (!password.trim()) nextErrors.password = 'Password is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const authPromise = isRegister
      ? passengerApi.register({
          name: fullName.trim(),
          email: email.trim(),
          mobile_number: `+63 ${digitsOnly(phoneNumber)}`,
          password,
          // Only ever true here — the form can't reach this point unless agreedToTerms was
          // explicitly checked (validated above), so this never sends fabricated consent.
          terms_accepted: agreedToTerms,
          privacy_policy_accepted: agreedToTerms,
        })
      : passengerApi.login(email.trim(), password);

    authPromise
      .then((res: any) => {
        login(mapAuthResponseToUserProfile(res, email.trim()), res.token);
        setLoading(false);
        onAuthenticated();
      })
      .catch((err: any) => {
        if (err?.status !== undefined) {
          // The backend was reached and rejected the request outright (wrong password, email
          // already taken) — a real failure, surfaced on the field it actually concerns instead
          // of silently logging the passenger in anyway.
          setLoading(false);
          if (isRegister) {
            setErrors({ email: err.message || 'Could not create your account. Please check your details.' });
          } else {
            setErrors({ password: err.message || 'Incorrect email or password. Please try again.' });
          }
          return;
        }
        // Backend unreachable — fall back to local demo data so the app stays usable/testable
        // offline, matching the rest of this app's behavior when the API can't be reached.
        if (isRegister) {
          runAuth({
            id: Date.now(),
            name: fullName.trim(),
            email: email.trim(),
            mobile: `+63 ${digitsOnly(phoneNumber)}`,
            rating: 5.0,
            totalRides: 0,
            emergencyContact: { name: '', phone: '' },
          });
        } else {
          runAuth({ ...DEMO_PASSENGER, email: email.trim() });
        }
      });
  };

  const handleSocialLogin = () => {
    if (loading) return;
    runAuth(DEMO_PASSENGER);
  };

  return (
    <Animated.View style={[styles.safeArea, { opacity: fade }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <Image
              source={require('../../assets/branding/trivora-logo-transparent.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />

            {/* Identifies which of the two Trivora apps this is at a glance — both apps share
                the same logo/layout, so without this a passenger and driver login screen are
                visually indistinguishable. Driver's own login screen carries the matching amber
                badge. */}
            <View style={styles.appBadge}>
              <User size={13} color={COLORS.primary} />
              <Text style={styles.appBadgeText}>PASSENGER APP</Text>
            </View>

            <Text style={styles.welcomeTitle}>
              {isRegister ? 'Create an account' : 'Welcome back, Passenger!'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {isRegister ? 'Sign up to start booking rides' : 'Log in to continue'}
            </Text>
          </View>

          {/* Full Name — register only */}
          {isRegister && (
            <>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={[styles.fieldBox, errors.name && styles.fieldBoxError]}>
                <User size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Full name"
                  placeholderTextColor={COLORS.textMuted}
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

              {/* Segmented Phone Input — register only */}
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <View style={[styles.phoneInputContainer, errors.phone && styles.fieldBoxError]}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.flagEmoji}>🇵🇭</Text>
                  <Text style={styles.countryCodeText}>+63</Text>
                </View>

                <View style={styles.inputDivider} />

                <TextInput
                  style={styles.numberInput}
                  placeholder="Mobile number"
                  placeholderTextColor={COLORS.textMuted}
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </>
          )}

          {/* Email */}
          <Text style={styles.fieldLabel}>Email Address</Text>
          <View style={[styles.fieldBox, errors.email && styles.fieldBoxError]}>
            <Mail size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Email address"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          {/* Password */}
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[styles.fieldBox, errors.password && styles.fieldBoxError]}>
            <Lock size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
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
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          {/* Confirm Password — register only */}
          {isRegister && (
            <>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={[styles.fieldBox, errors.confirmPassword && styles.fieldBoxError]}>
                <Lock size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Confirm password"
                  placeholderTextColor={COLORS.textMuted}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword((v) => !v)} activeOpacity={0.7}>
                  {showConfirmPassword ? (
                    <EyeOff size={18} color={COLORS.textSecondary} />
                  ) : (
                    <Eye size={18} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              ) : null}
            </>
          )}

          {/* Remember me + Forgot password — login only */}
          {!isRegister && (
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Terms & Conditions / Privacy Policy consent — register only, never pre-checked */}
          {isRegister && (
            <>
              <View style={styles.termsRow}>
                <TouchableOpacity
                  style={styles.checkboxTouchable}
                  onPress={() => {
                    setAgreedToTerms((v) => !v);
                    if (errors.terms) setErrors((prev) => ({ ...prev, terms: undefined }));
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                    {agreedToTerms && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.termsLabel}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => setLegalModal('terms')}>
                    Terms & Conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.termsLink} onPress={() => setLegalModal('privacy')}>
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
              {errors.terms ? <Text style={styles.errorText}>{errors.terms}</Text> : null}
            </>
          )}

          {/* Continue CTA Button */}
          <View style={styles.ctaSpacing}>
            <Button
              label={isRegister ? 'Create Account' : 'Log In'}
              onPress={handleContinue}
              loading={loading}
            />
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login */}
          <View style={styles.socialGroup}>
            <TouchableOpacity
              style={[styles.socialButton, loading && styles.socialButtonDisabled]}
              onPress={handleSocialLogin}
              activeOpacity={0.75}
              disabled={loading}
            >
              <GoogleIcon size={20} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Register Toggle Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={() => switchMode(!isRegister)} disabled={loading}>
              <Text style={styles.registerLink}>{isRegister ? 'Log In' : 'Register'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LegalDocumentModal
        visible={legalModal === 'terms'}
        onClose={() => setLegalModal(null)}
        title="Terms & Conditions"
        updatedLabel={LEGAL_LAST_UPDATED}
        sections={TERMS_SECTIONS}
      />
      <LegalDocumentModal
        visible={legalModal === 'privacy'}
        onClose={() => setLegalModal(null)}
        title="Privacy Policy"
        updatedLabel={LEGAL_LAST_UPDATED}
        sections={PRIVACY_SECTIONS}
      />
    </Animated.View>
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
  brandHeader: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  brandLogo: {
    width: 136,
    height: 136,
    marginBottom: 4,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  appBadgeText: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  welcomeTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
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
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.dangerDark,
    marginBottom: SPACING.sm,
    marginLeft: 2,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: BUTTONS.touchHeight,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  flagEmoji: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginRight: 10,
  },
  numberInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  forgotLinkText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: SPACING.sm,
  },
  checkboxTouchable: {
    padding: 4,
    margin: -4,
  },
  termsLabel: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  ctaSpacing: {
    marginTop: SPACING.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  socialGroup: {
    gap: 10,
    marginBottom: SPACING.xl,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    ...SHADOWS.sm,
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  socialButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
});
