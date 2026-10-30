import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { passengerApi, parseEmergencyContact } from '../services/api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import {
  Phone,
  PhoneCall,
  HelpCircle,
  Info,
  LogOut,
  ChevronDown,
  Pencil,
} from 'lucide-react-native';
import EditableAvatar from '../components/EditableAvatar';
import EditProfileModal from '../components/EditProfileModal';
import EmailCodeModal from '../components/EmailCodeModal';
import TabHeader from '../components/TabHeader';
import { TMO_CONTACT, ABOUT_TRIVORA, APP_VERSION } from '../constants/supportInfo';
import { callPhoneNumber } from '../utils/deviceContact';

interface MenuItem {
  key: string;
  label: string;
  icon: typeof PhoneCall;
  /** Tints just this row's icon — reserved for safety-relevant content, everything else stays neutral. */
  accentColor?: string;
  /** A real-data preview shown even while collapsed — omitted where there's no single natural preview. */
  subtitle?: string;
  /** `onPress` makes the value a link (e.g. tap to call). */
  rows: { label: string; value: string; onPress?: () => void }[];
  /** A short paragraph under the rows. */
  note?: string;
}

interface ProfileScreenProps {
  /** Status-bar height — this tab draws its navy header up underneath it. */
  topInset?: number;
}

export default function ProfileScreen({ topInset = 0 }: ProfileScreenProps) {
  const { user, logout, updateProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // Email change: the new address waits here until the code sent to it is confirmed.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [showEmailCode, setShowEmailCode] = useState(false);
  const [emailCodeResendAfter, setEmailCodeResendAfter] = useState(60);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // This screen only exists in the tree while the Profile tab is selected (App.tsx's tab switch
  // is a plain conditional render, not a persistent navigator), so mounting here already means
  // "just became active" — the same signal a focus effect would give in a stack navigator. Silent
  // (no loading flag): the existing `user` stays on screen the whole time, this just replaces it
  // once the fresh values arrive, so rating/totalRides/emergencyContact catch up after a booking
  // completed elsewhere without the passenger having to pull-to-refresh.
  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberSinceLabel = user?.memberSince
    ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  // Only the passenger's real saved contact — the same value Edit Profile is seeded with. (This
  // used to fill gaps with hardcoded demo values, so the row showed a contact that was never saved
  // and the edit form, correctly seeded from the real value, appeared to have lost it.)
  const emergencyContact = user?.emergencyContact;
  const emergencyContactName = emergencyContact?.name?.trim() || '';
  const emergencyContactPhone = emergencyContact?.phone?.trim() || '';
  const emergencyContactValue =
    [emergencyContactName, emergencyContactPhone].filter(Boolean).join(' · ') || 'Not set';

  // Saved Places has its own bottom tab (and the destination picker's Saved tab), so it isn't
  // repeated on Profile. "Settings" (language, notifications, GPS precision) was
  // static copy with no backing state or toggle anywhere in the app, so it's gone too —
  // everything below has a real destination, real data, or a real save action behind it.
  const supportItems: MenuItem[] = [
    {
      key: 'emergency',
      label: 'Emergency Contacts',
      icon: PhoneCall,
      subtitle: emergencyContactName || emergencyContactPhone || 'Not set',
      rows: [
        // 911 is the national emergency hotline (police, fire, ambulance).
        { label: 'Emergency hotline', value: '911', onPress: () => callPhoneNumber('911') },
        { label: 'Nasugbu TMO', value: TMO_CONTACT.hotline, onPress: () => callPhoneNumber(TMO_CONTACT.hotline) },
        { label: 'Emergency Contact', value: emergencyContactValue },
      ],
    },
    {
      key: 'help',
      label: 'Help Center',
      icon: HelpCircle,
      subtitle: `TMO · ${TMO_CONTACT.hotline}`,
      rows: [
        { label: 'Office', value: TMO_CONTACT.office },
        { label: 'Address', value: TMO_CONTACT.address },
        { label: 'Hotline', value: TMO_CONTACT.hotline, onPress: () => callPhoneNumber(TMO_CONTACT.hotline) },
        { label: 'Email', value: TMO_CONTACT.email },
        { label: 'Office hours', value: TMO_CONTACT.officeHours },
        { label: 'Closed', value: TMO_CONTACT.closed },
      ],
      note:
        'Left something in a tricycle? Call the TMO with the trip\'s date, time and plate number from Ride History. For fare or driver concerns, you can also send a message through the inquiry form on the Trivora website.',
    },
    {
      key: 'about',
      label: 'About Trivora',
      icon: Info,
      subtitle: `Version ${APP_VERSION}`,
      rows: [
        { label: 'App', value: 'Trivora Passenger' },
        { label: 'Version', value: APP_VERSION },
        { label: 'Run by', value: 'Traffic Management Office, Municipality of Nasugbu' },
        { label: 'Fares', value: 'Set by the TMO, calculated from the road distance' },
      ],
      note: ABOUT_TRIVORA,
    },
  ];

  const toggleExpanded = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  /**
   * Saves Edit Profile to the server (the screen refetches the profile on open, so anything only
   * kept locally would vanish). A new email is not saved here: a code is sent to the new address
   * and the email changes only once that code is confirmed (EmailCodeModal below).
   * Returns false when the save failed, so the Edit Profile sheet stays open.
   */
  const handleSaveProfile = async (fields: Partial<UserProfile>): Promise<boolean> => {
    const newEmail = fields.email?.trim().toLowerCase();
    const emailChanged = !!newEmail && newEmail !== (user?.email || '').trim().toLowerCase();

    // Send the code first: if the new email is refused (taken, invalid), nothing is saved.
    if (emailChanged) {
      try {
        const res = await passengerApi.sendEmailChangeCode(newEmail);
        setEmailCodeResendAfter(res?.resend_after_seconds ?? 60);
      } catch (err: any) {
        showToast(err?.message || 'Could not send a code to that email. Please try again.', 'info');
        return false;
      }
    }

    try {
      const res: any = await passengerApi.updateProfile({
        name: fields.name,
        mobile_number: fields.mobile,
        emergency_contact_name: fields.emergencyContact?.name,
        emergency_contact_phone: fields.emergencyContact?.phone,
      });
      updateProfile({
        name: res?.user?.name ?? fields.name,
        mobile: res?.user?.mobile_number ?? fields.mobile,
        emergencyContact: parseEmergencyContact(res?.user?.emergency_contact),
      });
    } catch (err: any) {
      showToast(err?.message || 'Could not save your profile. Please try again.', 'info');
      return false;
    }

    if (emailChanged) {
      setPendingEmail(newEmail);
      // Opened once the Edit Profile sheet has closed — iOS can't present a modal while
      // another is still animating out.
      setTimeout(() => setShowEmailCode(true), 400);
    } else {
      showToast('Profile updated');
    }
    return true;
  };

  const handleVerifyEmailChange = async (code: string) => {
    if (!pendingEmail) return;
    const res = await passengerApi.verifyEmailChange(pendingEmail, code); // throws -> shown in the modal
    updateProfile({ email: res?.user?.email ?? pendingEmail });
    setShowEmailCode(false);
    setPendingEmail(null);
    showToast('Email updated');
  };

  const handleLogoutPress = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  const renderMenuGroup = (sectionLabel: string, items: MenuItem[]) => (
    <View style={styles.menuGroup}>
      <Text style={styles.sectionLabel}>{sectionLabel}</Text>
      {items.map((item) => {
        const isExpanded = expandedKey === item.key;
        return (
          <View key={item.key}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => toggleExpanded(item.key)}
              activeOpacity={0.6}
            >
              <View style={styles.menuIconBadge}>
                <item.icon size={18} color={item.accentColor || COLORS.textSecondary} strokeWidth={1.8} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.subtitle ? (
                  <Text style={styles.menuSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                ) : null}
              </View>
              <ChevronDown
                size={16}
                color={COLORS.textMuted}
                style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.detailPanel}>
                {item.rows.map((row, index) => (
                  <View
                    key={row.label}
                    style={[styles.detailRow, index === item.rows.length - 1 && styles.detailRowLast]}
                  >
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    {row.onPress ? (
                      <TouchableOpacity onPress={row.onPress} accessibilityRole="button" accessibilityLabel={`Call ${row.value}`}>
                        <Text style={[styles.detailValue, styles.detailLink]} numberOfLines={3}>{row.value}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.detailValue} numberOfLines={3}>{row.value}</Text>
                    )}
                  </View>
                ))}
                {item.note ? <Text style={styles.detailNote}>{item.note}</Text> : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navy tab header (same as Home's); the identity card sits on its curve. */}
        <TabHeader topInset={topInset} title="Profile">
          {/* Identity Header — an asymmetric contact-card layout (avatar beside identity, corner
              edit action) rather than a centered stack, with a divided stat row for rating/rides
              matching the same visual language used for key numbers elsewhere in the app. */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              {/* tone="driver" here is deliberate, not a typo — same reasoning as HomeScreen's own
                  avatar: "driver" is this app's solid/default-profile look (matches the Driver
                  app's own Profile page exactly), while the lighter "passenger" tint is reserved
                  for showing someone else as a passenger. This is the passenger's own avatar. */}
              <EditableAvatar
                name={user?.name || 'Passenger'}
                imageUri={user?.avatarUrl}
                tone="driver"
                size={60}
                onPhotoChanged={(url) => updateProfile({ avatarUrl: url || undefined })}
              />

              <View style={styles.identityCol}>
                <Text style={styles.profileName} numberOfLines={1}>{user?.name || 'Passenger'}</Text>
                <View style={styles.phoneRow}>
                  <Phone size={12} color={COLORS.textMuted} />
                  <Text style={styles.profilePhone} numberOfLines={1}>{user?.mobile || '—'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.editIconBtn}
                onPress={() => setShowEditModal(true)}
                activeOpacity={0.8}
                accessibilityLabel="Edit profile"
              >
                <Pencil size={15} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerDivider} />

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{memberSinceLabel}</Text>
                <Text style={styles.statLabel}>Member Since</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user?.totalRides ?? 0}</Text>
                <Text style={styles.statLabel}>Total Rides</Text>
              </View>
            </View>
          </View>
        </TabHeader>

        {renderMenuGroup('Support', supportItems)}

        {/* Log Out — isolated destructive action, not buried in a settings list */}
        <TouchableOpacity style={styles.logOutBtn} onPress={handleLogoutPress} activeOpacity={0.8}>
          <LogOut size={18} color={COLORS.dangerDark} />
          <Text style={styles.logOutLabel}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={user}
        onSave={handleSaveProfile}
      />

      {/* New email: confirm the code sent to it before it replaces the current one */}
      <EmailCodeModal
        visible={showEmailCode && !!pendingEmail}
        email={pendingEmail || ''}
        resendAfterSeconds={emailCodeResendAfter}
        verifyLabel="Verify & Update Email"
        onVerify={handleVerifyEmailChange}
        onResend={async () => {
          if (pendingEmail) await passengerApi.sendEmailChangeCode(pendingEmail);
        }}
        onClose={() => {
          setShowEmailCode(false);
          setPendingEmail(null);
          showToast('Email not changed — the code was not confirmed.', 'info');
        }}
      />

      <ConfirmModal
        visible={showLogoutConfirm}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Identity card, on the TabHeader's curve.
  header: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    ...SHADOWS.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  identityCol: {
    flex: 1,
    paddingTop: 4,
  },
  profileName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  profilePhone: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  editIconBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginTop: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  menuGroup: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuIconBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
    gap: 1,
  },
  menuLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  menuSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  detailPanel: {
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  detailValue: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  detailLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  detailNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    lineHeight: 18,
    paddingTop: SPACING.sm,
  },
  logOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.md,
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.lg,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  logOutLabel: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.dangerDark,
  },
});
