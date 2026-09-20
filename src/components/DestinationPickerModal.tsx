import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, CATEGORY_COLORS, TYPOGRAPHY } from '../constants/theme';
import { POPULAR_DESTINATIONS, calculateDistance } from '../constants/todaRoutes';
import { searchPlaces, PlaceSearchResult } from '../services/routingService';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { LocationPoint } from '../types';
import {
  X,
  Search,
  MapPin,
  Navigation,
  Building2,
  ShoppingBag,
  Hospital,
  Anchor,
  School,
  TreePine,
  ChevronRight,
  Home,
  Briefcase,
  Bookmark,
} from 'lucide-react-native';
import PinLocationModal from './PinLocationModal';
import FilterTabs from './FilterTabs';
import SavedPlacesScreen from '../screens/SavedPlacesScreen';

type PlacesTab = 'saved' | 'suggested';

const PLACES_TAB_OPTIONS = [
  { key: 'suggested', label: 'Suggested' },
  { key: 'saved', label: 'Saved Places' },
];

const SAVED_PLACE_ICONS: Record<string, typeof Home> = {
  Home,
  Work: Briefcase,
  School,
};

const SEARCH_DEBOUNCE_MS = 400;

interface DestinationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationPoint) => void;
  /** 'destination' (default) shows Saved/Suggested places alongside search — Saved Places are
   * destination shortcuts only. 'pickup' shows only Search, Use Current Location, and Pin on
   * Map, matching the Change Pick-up flow. */
  mode?: 'pickup' | 'destination';
  currentLocation?: LocationPoint;
  onUseCurrentLocation?: () => void;
}

export default function DestinationPickerModal({
  visible,
  onClose,
  onSelect,
  mode = 'destination',
  currentLocation,
  onUseCurrentLocation,
}: DestinationPickerModalProps) {
  const isPickup = mode === 'pickup';
  const { savedPlaces } = useSavedPlaces();

  const [searchQuery, setSearchQuery] = useState('');
  const [placesTab, setPlacesTab] = useState<PlacesTab>('suggested');
  const [showPinModal, setShowPinModal] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // "See All" renders Saved Places as an overlay INSIDE this same Modal (not a second, separate
  // Modal instance) — two independently-mounted native Modals don't have a reliably controllable
  // stacking order (confirmed via react-native-web's portal-per-Modal implementation, where each
  // gets its own document.body-level DOM node whose relative order isn't guaranteed by render
  // order alone). Keeping it as a plain child here guarantees correct on-top stacking via normal
  // view order, and — as a side effect — this picker's own state is preserved for free, since
  // neither it nor this Modal ever unmounts while Saved Places covers it.
  const [showSavedPlacesOverlay, setShowSavedPlacesOverlay] = useState(false);

  const searchRequestIdRef = useRef(0);
  const isSearchMode = searchQuery.trim().length >= 2;

  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(searchQuery).then((results) => {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(results);
        setIsSearching(false);
        setHasSearched(true);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchMode]);

  // Reset transient UI state each time the sheet is reopened.
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setPlacesTab('suggested');
      setShowSavedPlacesOverlay(false);
    }
  }, [visible]);

  const isSaved = !isPickup && placesTab === 'saved';

  const getPlaceIcon = (place: LocationPoint) => {
    switch (place.category) {
      case 'Government':
        return <Building2 size={16} color={CATEGORY_COLORS.government} />;
      case 'Market':
        return <ShoppingBag size={16} color={CATEGORY_COLORS.market} />;
      case 'Hospital':
        return <Hospital size={16} color={CATEGORY_COLORS.hospital} />;
      case 'Harbor':
        return <Anchor size={16} color={CATEGORY_COLORS.harbor} />;
      case 'School':
        return <School size={16} color={CATEGORY_COLORS.school} />;
      case 'Leisure':
        return <TreePine size={16} color={CATEGORY_COLORS.leisure} />;
      default:
        return <MapPin size={16} color={COLORS.primary} />;
    }
  };

  const handleSelectSearchResult = (result: PlaceSearchResult) => {
    onSelect({ name: result.name, address: result.address, lat: result.lat, lng: result.lng, category: 'Search' });
    onClose();
  };

  const handleUseCurrentLocation = () => {
    onUseCurrentLocation?.();
    onClose();
  };

  const handleSeeAllSavedPlaces = () => setShowSavedPlacesOverlay(true);

  const title = isPickup ? 'Change Pick-up' : 'Where are you going?';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Saved vs Suggested — destination only; Saved Places are destination shortcuts. */}
          {!isPickup && (
            <View style={styles.placesTabRow}>
              <FilterTabs
                options={PLACES_TAB_OPTIONS}
                value={placesTab}
                onChange={(key) => setPlacesTab(key as PlacesTab)}
              />
            </View>
          )}

          {/* Search Input Box */}
          <View style={styles.searchBar}>
            <Search size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={isPickup ? 'Search a pick-up location...' : 'Search destination in Nasugbu...'}
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={isPickup}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <X size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {isPickup && !isSearchMode && onUseCurrentLocation && (
            <TouchableOpacity
              style={styles.currentLocationRow}
              onPress={handleUseCurrentLocation}
              activeOpacity={0.8}
            >
              <View style={styles.currentLocationIconCircle}>
                <Navigation size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.currentLocationText}>Use Current Location</Text>
              <ChevronRight size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {!isSearchMode && (
            <TouchableOpacity
              style={styles.pinOnMapCard}
              onPress={() => setShowPinModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.pinIconCircle}>
                <MapPin size={18} color="#FFFFFF" />
              </View>
              <View style={styles.pinTextCol}>
                <Text style={styles.pinCardTitle}>Pin Location on Map</Text>
                <Text style={styles.pinCardSub}>Tap anywhere on Nasugbu streets to set exact point</Text>
              </View>
              <ChevronRight size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {isSearchMode ? (
            <>
              <Text style={styles.listSectionLabel}>Search Results</Text>
              {isSearching ? (
                <View style={styles.searchStatusBox}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, idx) => `${item.lat},${item.lng},${idx}`}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    hasSearched ? (
                      <View style={styles.searchStatusBox}>
                        <Text style={styles.emptyText}>No matching places found.</Text>
                      </View>
                    ) : null
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.placeItem}
                      onPress={() => handleSelectSearchResult(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.placeIconBox}>
                        <MapPin size={16} color={COLORS.primary} />
                      </View>
                      <View style={styles.placeInfoCol}>
                        <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          ) : (
            !isPickup && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.listSectionLabel, styles.sectionHeaderLabel]}>
                    {isSaved ? 'Your Saved Places' : 'Suggested Places'}
                  </Text>
                  {isSaved && savedPlaces.length > 0 && (
                    <TouchableOpacity style={styles.seeAllBtn} onPress={handleSeeAllSavedPlaces} activeOpacity={0.7}>
                      <Text style={styles.seeAllBtnText}>See All</Text>
                      <ChevronRight size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>

                {isSaved ? (
                  <FlatList
                    data={savedPlaces}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <View style={styles.searchStatusBox}>
                        <Text style={styles.emptyText}>Save places you visit often for faster booking.</Text>
                        <TouchableOpacity style={styles.emptyAddBtn} onPress={handleSeeAllSavedPlaces} activeOpacity={0.8}>
                          <Text style={styles.emptyAddBtnText}>Manage Saved Places</Text>
                          <ChevronRight size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    }
                    renderItem={({ item: place }) => (
                      <TouchableOpacity
                        style={styles.placeItem}
                        onPress={() => {
                          onSelect({ name: place.label, address: place.address, lat: place.lat, lng: place.lng, category: 'Saved' });
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.placeIconBox}>
                          {React.createElement(SAVED_PLACE_ICONS[place.label] || Bookmark, {
                            size: 16,
                            color: COLORS.primary,
                          })}
                        </View>

                        <View style={styles.placeInfoCol}>
                          <Text style={styles.placeName}>{place.label}</Text>
                          <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
                        </View>

                        <ChevronRight size={18} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <FlatList
                    data={POPULAR_DESTINATIONS}
                    keyExtractor={(item) => item.name}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item: place }) => {
                      const dist = currentLocation ? calculateDistance(currentLocation, place) : 1.5;

                      return (
                        <TouchableOpacity
                          style={styles.placeItem}
                          onPress={() => {
                            onSelect(place);
                            onClose();
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.placeIconBox}>{getPlaceIcon(place)}</View>

                          <View style={styles.placeInfoCol}>
                            <Text style={styles.placeName}>{place.name}</Text>
                            <Text style={styles.placeAddress} numberOfLines={1}>
                              {place.address || 'Nasugbu, Batangas'}
                            </Text>
                          </View>

                          <View style={styles.placeMetaCol}>
                            <Text style={styles.placeDistance}>{dist} km</Text>
                            {place.zoneCode && (
                              <View style={styles.zoneBadge}>
                                <Text style={styles.zoneBadgeText}>{place.zoneCode.replace('TODA-', '')}</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </>
            )
          )}
        </View>

        {/* Interactive Pin Location Map Modal */}
        <PinLocationModal
          visible={showPinModal}
          onClose={() => setShowPinModal(false)}
          currentPickup={currentLocation}
          mode={mode}
          onConfirmPin={(loc) => {
            setShowPinModal(false);
            onSelect(loc);
            onClose();
          }}
        />

        {/* Saved Places, as a full-screen layer covering this same sheet rather than a second
            Modal — see showSavedPlacesOverlay above for why. Back just drops this flag, and the
            picker underneath (search text, selected tab, etc.) is exactly as it was left. */}
        {showSavedPlacesOverlay && (
          <View style={styles.savedPlacesOverlay}>
            <SavedPlacesScreen onBack={() => setShowSavedPlacesOverlay(false)} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  savedPlacesOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  sheetContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...SHADOWS.sheet,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
  placesTabRow: {
    // FilterTabs already bakes in SPACING.md (16) of its own horizontal padding; adding just
    // the SPACING.sm (8) difference here brings the tab track's total inset to SPACING.lg (24),
    // matching the search bar and other rows below it exactly instead of over- or under-shooting.
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.md,
  },
  listSectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SPACING.md,
  },
  sectionHeaderLabel: {
    flex: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllBtnText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.primary,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primaryTint,
    borderRadius: RADIUS.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  currentLocationIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pinOnMapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.lg,
    gap: 12,
    ...SHADOWS.sm,
  },
  pinIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTextCol: {
    flex: 1,
  },
  pinCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.dangerDarker,
  },
  pinCardSub: {
    fontSize: 11,
    color: COLORS.dangerDark,
    marginTop: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  searchStatusBox: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  emptyAddBtnText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 12,
  },
  placeIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfoCol: {
    flex: 1,
  },
  placeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  placeAddress: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  placeMetaCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  placeDistance: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  zoneBadge: {
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  zoneBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
