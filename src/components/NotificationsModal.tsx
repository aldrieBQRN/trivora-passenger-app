import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { NotificationItem } from '../types';
import { X, Bell, Receipt, AlertTriangle, Info, CheckCircle2 } from 'lucide-react-native';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
}

export default function NotificationsModal({
  visible,
  onClose,
  notifications,
  onMarkRead,
}: NotificationsModalProps) {
  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'receipt':
        return <Receipt size={18} color={COLORS.sky} />;
      case 'alert':
        return <AlertTriangle size={18} color={COLORS.danger} />;
      case 'promo':
        return <CheckCircle2 size={18} color={COLORS.success} />;
      default:
        return <Info size={18} color={COLORS.primary} />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const handleMarkAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => onMarkRead(n.id));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.contentCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Bell size={20} color={COLORS.primary} />
              <Text style={styles.title}>Notifications</Text>
            </View>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* List — flat rows separated by a hairline, not individually bordered/tinted cards.
              Unread is communicated by one clear signal (bold title + dot), not four stacked
              ones (the old bg tint + border tint + bold + dot all at once). */}
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => onMarkRead(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>{getNotificationIcon(item.type)}</View>

                <View style={styles.textContent}>
                  <View style={styles.topLine}>
                    <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.metaRight}>
                      {!item.read && <View style={styles.unreadDot} />}
                      <Text style={styles.itemTime}>{item.time}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemBody}>{item.body}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Bell size={36} color={COLORS.textSecondary} opacity={0.4} />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySub}>You are all caught up!</Text>
              </View>
            }
          />
        </View>
      </View>
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
    maxHeight: '80%',
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
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  itemTitleUnread: {
    fontWeight: '900',
    color: COLORS.primary,
  },
  itemTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  itemBody: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
