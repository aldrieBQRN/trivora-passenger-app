import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Mail, X } from 'lucide-react-native';
import { BUTTONS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

interface EmailCodeModalProps {
  visible: boolean;
  email: string;
  /** Seconds before "Resend code" is available (restart by changing the value). */
  resendAfterSeconds: number;
  /** Resolve on success; throw an Error whose message is shown in the modal. */
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onClose: () => void;
}

/** "Verify your email" modal for sign-up: 6-digit code entry with a resend countdown. */
export default function EmailCodeModal({
  visible,
  email,
  resendAfterSeconds,
  onVerify,
  onResend,
  onClose,
}: EmailCodeModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(resendAfterSeconds);

  // Fresh state each time the modal opens.
  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
      setInfo(null);
      setResendIn(resendAfterSeconds);
    }
  }, [visible, resendAfterSeconds]);

  useEffect(() => {
    if (!visible || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [visible, resendIn]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (err: any) {
      setError(err?.message || 'We could not verify the code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await onResend();
      setCode('');
      setInfo('A new code has been sent to your email.');
      setResendIn(resendAfterSeconds);
    } catch (err: any) {
      setError(err?.message || 'We could not send a new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
            <X size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Mail size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code we sent to <Text style={styles.email}>{email}</Text>.
          </Text>

          {info && !error ? <Text style={styles.info}>{info}</Text> : null}

          <TextInput
            style={[styles.codeInput, error && styles.codeInputError]}
            value={code}
            onChangeText={(text) => {
              setCode(text.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            placeholder="000000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            editable={!verifying}
            onSubmitEditing={verify}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.verifyButton, (verifying || code.length !== 6) && styles.verifyButtonDisabled]}
            onPress={verify}
            disabled={verifying || code.length !== 6}
            activeOpacity={0.85}
          >
            {verifying ? (
              <ActivityIndicator color={COLORS.textInverse} />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Didn't get the code? </Text>
            {resendIn > 0 ? (
              <Text style={styles.footerText}>Resend in {resendIn}s</Text>
            ) : (
              <TouchableOpacity onPress={resend} disabled={resending}>
                <Text style={styles.link}>{resending ? 'Sending...' : 'Resend code'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.changeEmail}>
            <Text style={styles.changeEmailText}>Change email address</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    padding: SPACING.sm,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  email: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  info: {
    ...TYPOGRAPHY.caption,
    color: COLORS.emerald,
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  codeInput: {
    alignSelf: 'stretch',
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 8,
  },
  codeInputError: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  error: {
    ...TYPOGRAPHY.caption,
    color: COLORS.dangerDark,
    alignSelf: 'stretch',
    marginTop: 6,
  },
  verifyButton: {
    alignSelf: 'stretch',
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  link: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
  },
  changeEmail: {
    paddingVertical: SPACING.sm,
  },
  changeEmailText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
