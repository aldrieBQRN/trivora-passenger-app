import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, Easing } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { SavedPlace } from '../types';
import {
  Bookmark,
  Home,
  Briefcase,
  School,
  Dumbbell,
  ShoppingBag,
  Church,
  Users,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import AddEditSavedPlaceModal from '../components/AddEditSavedPlaceModal';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

interface SavedPlacesScreenProps {
  onBack: () => void;
}

const PLACE_ICONS: Record<string, typeof Home> = {
  Home,
  Work: Briefcase,
  School,
  Gym: Dumbbell,
  Market: ShoppingBag,
  Church,
  Friend: Users,
};

/** Pulsing placeholder rows in the list's shape, shown while saved places first load. */
function SavedPlacesSkeleton() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }} accessibilityLabel="Loading saved places">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.iconBox, styles.skeletonBlock]} />
          <View style={styles.infoCol}>
            <View style={[styles.skeletonBlock, styles.skeletonLabel]} />
            <View style={[styles.skeletonBlock, styles.skeletonAddress]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export default function SavedPlacesScreen({ onBack }: SavedPlacesScreenProps) {
  const { savedPlaces, isLoading, addSavedPlace, editSavedPlace, removeSavedPlace } = useSavedPlaces();
  // First load only: skeleton rows instead of flashing the "no saved places" empty state.
  const showInitialLoading = isLoading && savedPlaces.length === 0;
  const { showToast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedPlace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openAdd = () => {
    setEditingPlace(null);
    setShowAddModal(true);
  };

  const openEdit = (place: SavedPlace) => {
    setEditingPlace(place);
    setShowAddModal(true);
  };

  const handleSave = async (fields: { label: string; address: string; lat: number; lng: number }) => {
    try {
      if (editingPlace) {
        await editSavedPlace(editingPlace.id, fields);
        showToast('Saved place updated.');
      } else {
        await addSavedPlace(fields);
        showToast('Saved place added.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not save this place. Please try again.', 'info');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeSavedPlace(deleteTarget.id);
      showToast('Saved place deleted.');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err?.message || 'Could not delete this place. Please try again.', 'info');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderItem = ({ item }: { item: SavedPlace }) => {
    const Icon = PLACE_ICONS[item.label] || Bookmark;
    // The whole row opens Edit; the pencil stays as the visible hint, the bin deletes.
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openEdit(item)}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${item.address}. Edit`}
      >
        <View style={styles.iconBox}>
          <Icon size={18} color={COLORS.primary} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => openEdit(item)}
          activeOpacity={0.7}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.label}`}
        >
          <Pencil size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setDeleteTarget(item)}
          activeOpacity={0.7}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.label}`}
        >
          <Trash2 size={16} color={COLORS.dangerDark} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Saved Places"
        onBack={onBack}
        rightIcon={Plus}
        onRightPress={openAdd}
      />

      <FlatList
        data={savedPlaces}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          showInitialLoading ? (
            <SavedPlacesSkeleton />
          ) : (
            <EmptyState
              icon={Bookmark}
              title="Saved Places"
              subtitle="Save places you visit often for faster booking."
              actionLabel="Add a Place"
              onAction={openAdd}
            />
          )
        }
        ListFooterComponent={
          savedPlaces.length > 0 ? (
            // Same dashed "add" row as Home's Saved places card — easier to find than the header +.
            <TouchableOpacity style={styles.addPlaceRow} onPress={openAdd} activeOpacity={0.7} accessibilityRole="button">
              <View style={styles.addPlaceIcon}>
                <Plus size={16} color={COLORS.primary} strokeWidth={2.4} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.addPlaceTitle}>Add a place</Text>
                <Text style={styles.address}>Home, work or any place you ride to often</Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
      />

      <AddEditSavedPlaceModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSave}
        editingPlace={editingPlace}
        onDelete={(place) => {
          setShowAddModal(false);
          setDeleteTarget(place);
        }}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Saved Place?"
        message={`Remove "${deleteTarget?.label}" from your saved places?`}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  label: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  address: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    marginTop: SPACING.md,
    paddingHorizontal: 12,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  addPlaceIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlaceTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  skeletonBlock: {
    backgroundColor: COLORS.border,
  },
  skeletonLabel: {
    width: '35%',
    height: 12,
    borderRadius: 6,
    marginVertical: 3,
  },
  skeletonAddress: {
    width: '70%',
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
});
