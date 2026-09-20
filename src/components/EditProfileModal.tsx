import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { UserProfile } from '../types';
import { X, User, Mail, Phone, ShieldAlert } from 'lucide-react-native';
import Button from './Button';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSave: (fields: Partial<UserProfile>) => void;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export default function EditProfileModal({ visible, onClose, user, onSave }: EditProfileModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; mobile?: string }>({});
  const [saving, setSaving] = useState(false);

  // Re-seed the form from the current user each time the modal opens.
  useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setMobile(user.mobile || '');
      setContactName(user.emergencyContact?.name || '');
      setContactPhone(user.emergencyContact?.phone || '');
      setErrors({});
      setSaving(false);
    }
  }, [visible, user]);

  const handleSave = () => {
    const nextErrors: { name?: string; email?: string; mobile?: string } = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'Enter a valid email address';
    if (digitsOnly(mobile).length < 10) nextErrors.mobile = 'Enter a valid mobile number';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setTimeout(() => {
      onSave({
        name: name.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        emergencyContact: { name: contactName.trim(), phone: contactPhone.trim() },
      });
      setSaving(false);
      onClose();
    }, 500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.contentCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={[styles.fieldBox, errors.name && styles.fieldBoxError]}>
              <User size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Full name"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                autoCapitalize="words"
                editable={!saving}
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

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
                editable={!saving}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <View style={[styles.fieldBox, errors.mobile && styles.fieldBoxError]}>
              <Phone size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Mobile number"
                placeholderTextColor={COLORS.textMuted}
                value={mobile}
                onChangeText={(text) => {
                  setMobile(text);
                  if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: undefined }));
                }}
                keyboardType="phone-pad"
                editable={!saving}
              />
            </View>
            {errors.mobile ? <Text style={styles.errorText}>{errors.mobile}</Text> : null}

            {/* Optional — surfaced read-only under Support today with no way to set it;
                editing it here closes that gap using the exact same save flow. */}
            <Text style={styles.sectionLabel}>Emergency Contact (Optional)</Text>

            <View style={styles.fieldBox}>
              <ShieldAlert size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Contact name"
                placeholderTextColor={COLORS.textMuted}
                value={contactName}
                onChangeText={setContactName}
                autoCapitalize="words"
                editable={!saving}
              />
            </View>

            <View style={styles.fieldBox}>
              <Phone size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Contact phone number"
                placeholderTextColor={COLORS.textMuted}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                editable={!saving}
              />
            </View>

            <View style={styles.saveSpacing}>
              <Button label="Save Changes" onPress={handleSave} loading={saving} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  contentCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...SHADOWS.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    padding: SPACING.lg,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
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
  saveSpacing: {
    marginTop: SPACING.sm,
  },
});
