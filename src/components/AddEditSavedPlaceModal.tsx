import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { SavedPlace } from '../types';
import { POPULAR_DESTINATIONS } from '../constants/todaRoutes';
import { searchPlaces, PlaceSearchResult } from '../services/routingService';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useToast } from './Toast';
import {
  X,
  Search,
  MapPin,
  ChevronLeft,
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
import PinLocationModal from './PinLocationModal';
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

const SEARCH_DEBOUNCE_MS = 400;

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
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  // Freshly re-fetched each time "Pin on Map" is opened — never carries over the last picked
  // point or a hardcoded fallback, so the map always starts centered on the passenger's real
  // current position (see handleOpenPinModal below).
  const [pinStartLocation, setPinStartLocation] = useState<PickedLocation | undefined>(undefined);
  const { requestCurrentLocation, isLocating: isLocatingPin } = useCurrentLocation();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);

  // Re-seed each time the modal opens — either into edit mode with the existing place, or a
  // clean add flow.
  useEffect(() => {
    if (!visible) return;
    setSearchQuery('');
    setSearchResults([]);
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

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(searchQuery).then((results) => {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(results);
        setIsSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearchMode = searchQuery.trim().length >= 2;

  const handlePickResult = (result: PlaceSearchResult) => {
    setPicked({ name: result.name, address: result.address, lat: result.lat, lng: result.lng });
    setLabel((prev) => prev || result.name);
    setStep('confirm');
  };

  const handlePickSuggested = (place: { name: string; address?: string; lat: number; lng: number }) => {
    setPicked({ name: place.name, address: place.address || place.name, lat: place.lat, lng: place.lng });
    setLabel((prev) => prev || place.name);
    setStep('confirm');
  };

  const handleConfirmPin = (loc: { name: string; address?: string; lat: number; lng: number }) => {
    setShowPinModal(false);
    setPicked({ name: loc.name, address: loc.address || loc.name, lat: loc.lat, lng: loc.lng });
    setLabel((prev) => prev || loc.name);
    setStep('confirm');
  };

  // Re-fetches real device GPS every time "Pin on Map" is opened, so the map always starts on
  // the passenger's current position — never the last picked pin, the place being edited, or a
  // hardcoded town coordinate. If GPS is unavailable, the map still opens (so the passenger can
  // still drop a pin manually) but starts from a generic viewport, and a toast explains why —
  // never a fabricated "current location".
  const handleOpenPinModal = async () => {
    const coords = await requestCurrentLocation();
    if (coords) {
      setPinStartLocation({ name: 'Current Location', address: 'Current Location', lat: coords.lat, lng: coords.lng });
    } else {
      setPinStartLocation(undefined);
      showToast('Could not get your current location. You can still drop a pin manually.', 'info');
    }
    setShowPinModal(true);
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
      {/* Full-screen picker — search, suggested places, pin on map. Only shown while adding a
          new place; editing an existing one jumps straight to the confirm bottom sheet below. */}
      <Modal visible={visible && step === 'pick'} animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.headerIconBtn} />
            <Text style={styles.title}>Add a Place</Text>
            <TouchableOpacity style={styles.headerIconBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickStep}>
            <View style={styles.searchBar}>
                <Search size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search a real location..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                    <X size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.pinRow}
                onPress={handleOpenPinModal}
                activeOpacity={0.8}
                disabled={isLocatingPin}
              >
                <View style={styles.pinIconCircle}>
                  {isLocatingPin ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MapPin size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.pinRowText}>
                  {isLocatingPin ? 'Getting your location...' : 'Pin exact location on map'}
                </Text>
              </TouchableOpacity>

              {isSearchMode ? (
                <>
                  <Text style={styles.listSectionLabel}>Search Results</Text>
                  {isSearching ? (
                    <View style={styles.statusBox}>
                      <ActivityIndicator color={COLORS.primary} />
                    </View>
                  ) : (
                    <FlatList
                      style={styles.resultsList}
                      data={searchResults}
                      keyExtractor={(item, idx) => `${item.lat},${item.lng},${idx}`}
                      contentContainerStyle={styles.listContent}
                      keyboardShouldPersistTaps="handled"
                      ListEmptyComponent={
                        <View style={styles.statusBox}>
                          <Text style={styles.emptyText}>No matching places found.</Text>
                        </View>
                      }
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.resultItem} onPress={() => handlePickResult(item)} activeOpacity={0.7}>
                          <View style={styles.resultIconBox}>
                            <MapPin size={16} color={COLORS.primary} />
                          </View>
                          <View style={styles.resultTextCol}>
                            <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.listSectionLabel}>Suggested Places</Text>
                  <FlatList
                    style={styles.resultsList}
                    data={POPULAR_DESTINATIONS}
                    keyExtractor={(item) => item.name}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.resultItem} onPress={() => handlePickSuggested(item)} activeOpacity={0.7}>
                        <View style={styles.resultIconBox}>
                          <MapPin size={16} color={COLORS.primary} />
                        </View>
                        <View style={styles.resultTextCol}>
                          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm Place — a bottom sheet, not full-screen, since it's a short final step (label +
          save) layered on top of whichever screen/flow opened this picker in the first place. */}
      <Modal visible={visible && step === 'confirm'} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.confirmOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.confirmSheet}>
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

      <PinLocationModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        initialLocation={pinStartLocation}
        onConfirmPin={handleConfirmPin}
        confirmLabel="Use This Location"
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
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
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  // Overrides `header`'s status-bar clearance for the confirm bottom sheet, which — unlike the
  // full-screen picker — doesn't start at the very top of the screen, so it only needs the
  // sheet's own modest top padding, not a status-bar-height gap or the picker's shadow.
  confirmHeader: {
    paddingTop: SPACING.md,
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
  pickStep: {
    flex: 1,
  },
  resultsList: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: 4,
    paddingVertical: 10,
  },
  pinIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinRowText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.primary,
  },
  listSectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  statusBox: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  resultIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTextCol: {
    flex: 1,
  },
  resultName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  resultAddress: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
  },
});
