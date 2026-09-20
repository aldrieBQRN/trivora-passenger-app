import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, RADIUS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
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
  ChevronRight,
  Pencil,
  Bookmark,
} from 'lucide-react-native';
import EditableAvatar from '../components/EditableAvatar';
import EditProfileModal from '../components/EditProfileModal';
import SavedPlacesScreen from './SavedPlacesScreen';

interface MenuItem {
  key: string;
  label: string;
  icon: typeof PhoneCall;
  /** Tints just this row's icon — reserved for safety-relevant content, everything else stays neutral. */
  accentColor?: string;
  /** A real-data preview shown even while collapsed — omitted where there's no single natural preview. */
  subtitle?: string;
  rows: { label: string; value: string }[];
}

export default function ProfileScreen() {
  const { user, logout, updateProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
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

  if (showSavedPlaces) {
    return <SavedPlacesScreen onBack={() => setShowSavedPlaces(false)} />;
  }

  const memberSinceLabel = user?.memberSince
    ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const emergencyContact = user?.emergencyContact;
  const emergencyContactName = emergencyContact?.name || 'Maria Baquiran';
  const emergencyContactPhone = emergencyContact?.phone || '0906 703 5958';
  const emergencyContactValue = `${emergencyContactName} · ${emergencyContactPhone}`;

  // Saved Places used to be mirrored here as a static, unsynced readout — real, actionable
  // saved places now live in the destination picker's own Saved Places tab, so this list
  // isn't duplicated on Profile. "Settings" (language, notifications, GPS precision) was
  // static copy with no backing state or toggle anywhere in the app, so it's gone too —
  // everything below has a real destination, real data, or a real save action behind it.
  const supportItems: MenuItem[] = [
    {
      key: 'emergency',
      label: 'Emergency Contacts',
      icon: PhoneCall,
      accentColor: COLORS.dangerDark,
      subtitle: emergencyContactName,
      rows: [
        { label: 'Nasugbu PNP Police Station', value: '(043) 931-1234 / 117' },
        { label: 'Municipal Traffic Office (TMO)', value: '(043) 931-5678' },
        { label: 'Emergency Contact', value: emergencyContactValue },
      ],
    },
    {
      key: 'help',
      label: 'Help Center',
      icon: HelpCircle,
      rows: [
        { label: 'Hotline', value: '(043) 931-5678' },
        { label: 'Email', value: 'support@trivora-nasugbu.gov.ph' },
        { label: 'Office', value: 'Ground Floor, Nasugbu Municipal Hall' },
      ],
    },
    {
      key: 'about',
      label: 'About Trivora',
      icon: Info,
      subtitle: 'v1.0.0',
      rows: [
        { label: 'Version', value: 'Trivora Trike Transit System v1.0.0' },
        { label: 'Authority', value: 'Nasugbu Municipal Ordinance No. 2024-88' },
        { label: 'Franchise checks', value: 'Standardized fares · Verified MTOP units' },
      ],
    },
  ];

  const toggleExpanded = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleSaveProfile = async (fields: Partial<UserProfile>) => {
    // Name/email/mobile are applied optimistically to local state, same as before this fix —
    // that part of Edit Profile was never reported broken. Emergency Contact is the one field
    // with no backend persistence at all, so it's saved through the API here and reconciled with
    // whatever the backend actually stored, rather than just trusting what was typed.
    updateProfile(fields);

    if (fields.emergencyContact) {
      try {
        const res: any = await passengerApi.updateProfile({
          emergency_contact_name: fields.emergencyContact.name,
          emergency_contact_phone: fields.emergencyContact.phone,
        });
        updateProfile({ emergencyContact: parseEmergencyContact(res?.user?.emergency_contact) });
      } catch (err: any) {
        showToast(err?.message || 'Could not save your emergency contact. Please try again.', 'info');
        return;
      }
    }

    showToast('Profile updated');
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
                    <Text style={styles.detailValue} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
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

        {/* Saved Places — a plain navigation row (not expandable) since it opens its own screen,
            same treatment as Support items but a single tap goes straight there. */}
        <View style={styles.menuGroup}>
          <Text style={styles.sectionLabel}>Booking</Text>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowSavedPlaces(true)}
            activeOpacity={0.6}
          >
            <View style={styles.menuIconBadge}>
              <Bookmark size={18} color={COLORS.textSecondary} strokeWidth={1.8} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuLabel}>Saved Places</Text>
            </View>
            <ChevronRight size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {renderMenuGroup('Support', supportItems)}

        {/* Log Out — isolated destructive action, not buried in a settings list */}
        <TouchableOpacity style={styles.logOutBtn} onPress={handleLogoutPress} activeOpacity={0.8}>
          <LogOut size={18} color={COLORS.danger} />
          <Text style={styles.logOutLabel}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={user}
        onSave={handleSaveProfile}
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
  header: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    fontWeight: '800',
    color: COLORS.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
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
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  logOutLabel: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.danger,
  },
});
