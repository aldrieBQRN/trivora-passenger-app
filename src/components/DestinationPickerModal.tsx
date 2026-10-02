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
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { calculateDistance } from '../constants/todaRoutes';
import { searchPlaces, PlaceSearchResult } from '../services/routingService';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { LocationPoint } from '../types';
import {
  X,
  Search,
  MapPin,
  Navigation,
  School,
  ChevronRight,
  Home,
  Briefcase,
  Bookmark,
} from 'lucide-react-native';
import PinLocationModal from './PinLocationModal';
import FilterTabs from './FilterTabs';
import SavedPlacesScreen from '../screens/SavedPlacesScreen';
import PlaceCategoryChips from './PlaceCategoryChips';
import { useNearbyPlaces } from '../hooks/useNearbyPlaces';
import { getCategoryDefinition } from '../constants/placeCategories';

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
  mode?: 'pickup' | 'destination';
  currentLocation?: LocationPoint;
  initialLocation?: LocationPoint;
  onUseCurrentLocation?: () => void;
  /** Which places tab is shown when the sheet opens (destination mode) — e.g. Home's "More"
   * shortcut opens straight onto Saved Places. */
  initialPlacesTab?: PlacesTab;
}

export default function DestinationPickerModal({
  visible,
  onClose,
  onSelect,
  mode = 'destination',
  currentLocation,
  initialLocation,
  onUseCurrentLocation,
  initialPlacesTab = 'suggested',
}: DestinationPickerModalProps) {
  const isPickup = mode === 'pickup';
  const { savedPlaces } = useSavedPlaces();

  const searchCenter = currentLocation
    ? { lat: currentLocation.lat, lng: currentLocation.lng }
    : initialLocation
    ? { lat: initialLocation.lat, lng: initialLocation.lng }
    : { lat: 14.0718, lng: 120.6325 };

  const {
    selectedCategory,
    setSelectedCategory,
    places: nearbyPlaces,
    isLoading: isLoadingNearby,
  } = useNearbyPlaces({
    searchCenter,
    enabled: visible,
    initialCategory: 'all',
  });

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
      setSelectedCategory('all');
      setPlacesTab(initialPlacesTab);
      setShowSavedPlacesOverlay(false);
    }
  }, [visible, initialPlacesTab]);

  const isSaved = !isPickup && placesTab === 'saved';


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
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} accessibilityLabel="Close">
              <X size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

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
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Clear search"
              >
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
              style={styles.pinOnMapRow}
              onPress={() => setShowPinModal(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={styles.pinIconBox}>
                <MapPin size={18} color={COLORS.primary} />
              </View>
              <View style={styles.pinTextCol}>
                <Text style={styles.pinRowTitle}>Pin location on map</Text>
                <Text style={styles.pinRowSub}>Set an exact point on Nasugbu streets</Text>
              </View>
              <ChevronRight size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {/* Main 2 Tabs: [ Suggested | Saved Places ] */}
          {!isPickup && !isSearchMode && (
            <View style={styles.placesTabRow}>
              <FilterTabs
                options={PLACES_TAB_OPTIONS}
                value={placesTab}
                onChange={(key) => setPlacesTab(key as PlacesTab)}
              />
            </View>
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
          ) : !isPickup && placesTab === 'saved' ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.listSectionLabel, styles.sectionHeaderLabel]}>Your Saved Places</Text>
                {savedPlaces.length > 0 && (
                  <TouchableOpacity style={styles.seeAllBtn} onPress={handleSeeAllSavedPlaces} activeOpacity={0.7}>
                    <Text style={styles.seeAllBtnText}>See All</Text>
                    <ChevronRight size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>

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
            </>
          ) : (
            /* Suggested Places tab (with category filter and nearby place discovery) */
            <>
              {/* Category Filter Chips inside Suggested */}
              <View style={styles.categoryChipsWrapper}>
                <PlaceCategoryChips
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  isLoading={isLoadingNearby}
                />
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.listSectionLabel, styles.sectionHeaderLabel]}>
                  {isPickup
                    ? 'Suggested Pick-up Points'
                    : selectedCategory === 'all'
                    ? 'All Nearby Places'
                    : `Nearby ${getCategoryDefinition(selectedCategory).label}`}
                </Text>
              </View>

              <FlatList
                data={nearbyPlaces}
                keyExtractor={(item, idx) => `${item.id || item.name}-${idx}`}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  isLoadingNearby ? (
                    <View style={styles.searchStatusBox}>
                      <ActivityIndicator color={COLORS.primary} />
                      <Text style={styles.emptyText}>
                        {selectedCategory === 'all'
                          ? 'Finding nearby places in Nasugbu…'
                          : `Finding nearby ${getCategoryDefinition(selectedCategory).label.toLowerCase()}…`}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.searchStatusBox}>
                      <Text style={styles.emptyText}>
                        {selectedCategory === 'all'
                          ? 'No nearby places found.'
                          : `No ${getCategoryDefinition(selectedCategory).label.toLowerCase()} found nearby.`}
                      </Text>
                    </View>
                  )
                }
                renderItem={({ item }) => {
                  const catDef = getCategoryDefinition(item.category || selectedCategory);
                  const CatIcon = catDef.icon;
                  const distKm = currentLocation
                    ? calculateDistance(currentLocation, { name: item.name, lat: item.latitude, lng: item.longitude })
                    : null;

                  return (
                    <TouchableOpacity
                      style={styles.placeItem}
                      onPress={() => {
                        onSelect({
                          name: item.name,
                          address: item.address || 'Nasugbu, Batangas',
                          lat: item.latitude,
                          lng: item.longitude,
                          category: catDef.label,
                        });
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.placeIconBox, { backgroundColor: catDef.tintColor || COLORS.primaryTint }]}>
                        <CatIcon size={17} color={catDef.color} />
                      </View>

                      <View style={styles.placeInfoCol}>
                        <Text style={styles.placeName}>{item.name}</Text>
                        <Text style={styles.placeAddress} numberOfLines={1}>
                          {item.address || 'Nasugbu, Batangas'}
                        </Text>
                      </View>

                      {distKm != null && (
                        <View style={styles.placeMetaCol}>
                          <Text style={styles.placeDistance}>{distKm} km</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          )}
        </View>

        {/* Interactive Pin Location Map Modal */}
        <PinLocationModal
          visible={showPinModal}
          onClose={() => setShowPinModal(false)}
          currentPickup={currentLocation}
          initialLocation={initialLocation}
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
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    height: 52,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  categoryChipsWrapper: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  headerLoader: {
    marginRight: SPACING.lg,
  },
  placesTabRow: {
    // FilterTabs already bakes in SPACING.md (16) of its own horizontal padding; adding just
    // the SPACING.sm (8) difference here brings the tab track's total inset to SPACING.lg (24),
    // matching the search bar and other rows below it exactly instead of over- or under-shooting.
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
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
    fontWeight: '700',
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
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.primary,
  },
  pinOnMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  pinIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTextCol: {
    flex: 1,
  },
  pinRowTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pinRowSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 12,
  },
  placeIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfoCol: {
    flex: 1,
  },
  placeName: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  placeAddress: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  placeMetaCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  placeDistance: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  zoneBadge: {
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  zoneBadgeText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.primary,
  },
});
