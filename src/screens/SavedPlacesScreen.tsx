import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
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

export default function SavedPlacesScreen({ onBack }: SavedPlacesScreenProps) {
  const { savedPlaces, addSavedPlace, editSavedPlace, removeSavedPlace } = useSavedPlaces();
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
    return (
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Icon size={18} color={COLORS.primary} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)} activeOpacity={0.7}>
          <Pencil size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setDeleteTarget(item)} activeOpacity={0.7}>
          <Trash2 size={16} color={COLORS.dangerDark} />
        </TouchableOpacity>
      </View>
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
          <EmptyState
            icon={Bookmark}
            title="Saved Places"
            subtitle="Save places you visit often for faster booking."
            actionLabel="Add a Place"
            onAction={openAdd}
          />
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
});
