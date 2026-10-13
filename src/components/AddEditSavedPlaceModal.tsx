import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { SavedPlace } from '../types';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import {
  X,
  ChevronLeft,
  MapPin,
  Home,
  Briefcase,
  School,
  Dumbbell,
  ShoppingBag,
  Church,
  Users,
  MoreHorizontal,
  Tag,
  Trash2,
} from 'lucide-react-native';
import DestinationSearchScreen from '../screens/DestinationSearchScreen';
import Button from './Button';

interface AddEditSavedPlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (place: { label: string; address: string; lat: number; lng: number }) => Promise<void> | void;
  /** Present when editing an existing place; absent when adding a new one. */
  editingPlace?: SavedPlace | null;
  /** When provided, shows a Delete action in edit mode — the parent owns the actual
   * confirm-and-delete flow (same ConfirmModal used by the Saved Places list). */
  onDelete?: (place: SavedPlace) => void;
}

const LABEL_PRESETS = [
  { label: 'Home', icon: Home },
  { label: 'Work', icon: Briefcase },
  { label: 'School', icon: School },
  { label: 'Gym', icon: Dumbbell },
  { label: 'Market', icon: ShoppingBag },
  { label: 'Church', icon: Church },
  { label: 'Friend', icon: Users },
  { label: 'Other', icon: MoreHorizontal },
];

interface PickedLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export default function AddEditSavedPlaceModal({
  visible,
  onClose,
  onSave,
  editingPlace,
  onDelete,
}: AddEditSavedPlaceModalProps) {
  // Bottom sheet clears the phone's navigation bar (gesture or 3-button).
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  // Destination for DestinationSearchScreen: freshly resolved device GPS whenever the pick step
  // opens, so its nearby/suggested places and pin-map center on the passenger. Falls back to
  // undefined (Nasugbu town center) when GPS is unavailable — never a fabricated position.
  const [pickStartLocation, setPickStartLocation] = useState<PickedLocation | undefined>(undefined);
  const { requestCurrentLocation } = useCurrentLocation();
  // Set when a destination is picked so the picker's own post-selection onBack() (which always
  // follows onSelect) is recognized as its internal auto-dismiss — not a user cancel.
  const justSelectedRef = useRef(false);

  // Re-seed each time the modal opens — either into edit mode with the existing place, or a
  // clean add flow.
  useEffect(() => {
    if (!visible) return;
    justSelectedRef.current = false;
    setSaving(false);
    if (editingPlace) {
      setPicked({
        name: editingPlace.label,
        address: editingPlace.address,
        lat: editingPlace.lat,
        lng: editingPlace.lng,
      });
      setLabel(editingPlace.label);
      setStep('confirm');
    } else {
      setPicked(null);
      setLabel('');
      setStep('pick');
    }
  }, [visible, editingPlace]);

  // Fresh device GPS whenever the pick step is on screen (add flow, or an edit's "Change
  // Location") so suggestions/pin-map start where the passenger actually is.
  useEffect(() => {
    if (!visible || step !== 'pick') return;
    requestCurrentLocation().then((coords) => {
      setPickStartLocation(
        coords ? { name: 'Current Location', address: 'Current Location', lat: coords.lat, lng: coords.lng } : undefined
      );
    });
  }, [visible, step, requestCurrentLocation]);

  const handlePickResult = (result: { name: string; address: string; lat: number; lng: number }) => {
    justSelectedRef.current = true;
    setPicked({ name: result.name, address: result.address, lat: result.lat, lng: result.lng });
    setLabel((prev) => prev || result.name);
    setStep('confirm');
  };

  const handleSave = async () => {
    if (!picked || !label.trim()) return;
    setSaving(true);
    try {
      await onSave({ label: label.trim(), address: picked.address, lat: picked.lat, lng: picked.lng });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!picked && label.trim().length > 0;

  return (
    <>
      {/* Full-screen destination picker — the same destination-selection page Home shows, embedded
          in a modal so it layers above whichever screen opened this add flow. Picking a search
          result, a suggested/nearby place, a saved place, or a pinned map location drops the
          passenger into the confirm bottom sheet below. */}
      <Modal visible={visible && step === 'pick'} animationType="slide" onRequestClose={onClose}>
        <DestinationSearchScreen
          title="Add a Place"
          onBack={() => {
            if (justSelectedRef.current) {
              // The picker auto-dismisses itself after a selection (it fires onSelect, then this
              // onBack) — the confirm step already owns the flow, so this trailing call must not
              // close the whole modal. Consume the flag so a later header-back works normally.
              justSelectedRef.current = false;
              return;
            }
            onClose();
          }}
          mode="destination"
          currentLocation={pickStartLocation}
          onSelect={(loc) => handlePickResult({ name: loc.name, address: loc.address || loc.name, lat: loc.lat, lng: loc.lng })}
        />
      </Modal>

      {/* Confirm Place — a bottom sheet, not full-screen, since it's a short final step (label +
          save) layered on top of whichever screen/flow opened this picker in the first place. */}
      <Modal visible={visible && step === 'confirm'} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.confirmOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.confirmSheet, { paddingBottom: Math.max(insets.bottom + SPACING.sm, Platform.OS === 'ios' ? 34 : 20) }]}>
            <View style={[styles.header, styles.confirmHeader]}>
              {!editingPlace ? (
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => setStep('pick')} activeOpacity={0.7}>
                  <ChevronLeft size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.headerIconBtn} />
              )}
              <Text style={styles.title}>{editingPlace ? 'Edit Saved Place' : 'Confirm Place'}</Text>
              <TouchableOpacity style={styles.headerIconBtn} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.confirmForm}>
              <Text style={styles.fieldLabel}>Location</Text>
              <View style={styles.locationBox}>
                <MapPin size={16} color={COLORS.danger} />
                <Text style={styles.locationText} numberOfLines={2}>{picked?.address}</Text>
              </View>

              <Text style={styles.fieldLabel}>Label</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetRow}
              >
                {LABEL_PRESETS.map((preset) => {
                  const isSelected = label === preset.label;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                      onPress={() => setLabel(preset.label)}
                      activeOpacity={0.7}
                    >
                      <preset.icon size={13} color={isSelected ? '#FFFFFF' : COLORS.primary} />
                      <Text style={[styles.presetChipText, isSelected && styles.presetChipTextSelected]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.fieldBox}>
                <Tag size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Home, Work, Lola's House"
                  placeholderTextColor={COLORS.textMuted}
                  value={label}
                  onChangeText={setLabel}
                  maxLength={100}
                />
              </View>

              <TouchableOpacity style={styles.changeLocationLink} onPress={() => setStep('pick')} activeOpacity={0.7}>
                <Text style={styles.changeLocationText}>Change Location</Text>
              </TouchableOpacity>

              <Button label="Save Place" onPress={handleSave} loading={saving} disabled={!canSave} />

              {editingPlace && onDelete && (
                <TouchableOpacity
                  style={styles.deleteLink}
                  onPress={() => {
                    onClose();
                    onDelete(editingPlace);
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color={COLORS.dangerDark} />
                  <Text style={styles.deleteLinkText}>Delete Saved Place</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...SHADOWS.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  confirmHeader: {
    shadowOpacity: 0,
    elevation: 0,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  confirmForm: {
    padding: SPACING.lg,
    gap: 6,
  },
  fieldLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  locationText: {
    flex: 1,
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: SPACING.md,
    marginBottom: SPACING.sm,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  presetChipSelected: {
    backgroundColor: COLORS.primary,
  },
  presetChipText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.primary,
  },
  presetChipTextSelected: {
    color: '#FFFFFF',
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
  },
  fieldInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  changeLocationLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  changeLocationText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: 8,
  },
  deleteLinkText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.dangerDark,
    fontWeight: '700',
  },
});