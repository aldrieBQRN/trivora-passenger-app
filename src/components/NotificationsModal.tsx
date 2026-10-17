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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY, FONT_FAMILY } from '../constants/theme';
import { NotificationItem } from '../types';
import { X, Bell, Receipt, AlertTriangle, Info, CheckCircle2 } from 'lucide-react-native';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  /** Server-side unread total (may exceed the unread rows loaded in this list). */
  unreadCount: number;
  /** Marks the notification read and opens what it is about (e.g. the ride's e-receipt). */
  onOpen: (item: NotificationItem) => void;
  onMarkAllRead: () => void;
}

/**
 * The passenger's notification center — the persistent notifications from NotificationsContext,
 * the same items that arrive as phone notifications.
 */
export default function NotificationsModal({
  visible,
  onClose,
  notifications,
  unreadCount,
  onOpen,
  onMarkAllRead,
}: NotificationsModalProps) {
  // Bottom sheet clears the phone's navigation bar (gesture or 3-button).
  const insets = useSafeAreaInsets();
  // Icon + tone per type — same round, tinted bubbles as the Driver app's notification rows.
  const typeVisual = (type: NotificationItem['type']) => {
    switch (type) {
      case 'receipt':
        return { Icon: Receipt, color: COLORS.primary, bubble: styles.iconBubbleInfo };
      case 'alert':
        return { Icon: AlertTriangle, color: COLORS.dangerDark, bubble: styles.iconBubbleDanger };
      case 'promo':
        return { Icon: CheckCircle2, color: COLORS.success, bubble: styles.iconBubbleSuccess };
      default:
        return { Icon: Info, color: COLORS.primary, bubble: styles.iconBubbleInfo };
    }
  };


  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.contentCard, { paddingBottom: Math.max(insets.bottom + SPACING.sm, Platform.OS === 'ios' ? 34 : 20) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Bell size={20} color={COLORS.primary} />
              {/* Unread count sits under the title rather than beside it */}
              <View>
                <Text style={styles.title}>Notifications</Text>
                {/* Always shown — reads "0 unread" after Mark all read instead of disappearing */}
                <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={onMarkAllRead} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            renderItem={({ item }) => {
              const { Icon, color, bubble } = typeVisual(item.type);
              return (
                <TouchableOpacity
                  style={styles.itemRow}
                  onPress={() => onOpen(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBubble, bubble]}>
                    <Icon size={17} color={color} />
                  </View>

                  <View style={styles.textContent}>
                    <View style={styles.topLine}>
                      <Text style={[styles.itemTitle, item.read && styles.itemTitleRead]} numberOfLines={1}>
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
              );
            }}
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
  unreadLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  markAllText: {
    fontFamily: FONT_FAMILY,
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
  // Rows — same as the Driver app's notification rows (bubble icon, bold title while unread).
  itemRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleDanger: {
    backgroundColor: COLORS.dangerLight,
  },
  iconBubbleInfo: {
    backgroundColor: COLORS.backgroundSubtle,
  },
  iconBubbleSuccess: {
    backgroundColor: COLORS.successLight,
  },
  textContent: {
    flex: 1,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  itemTitleRead: {
    fontFamily: FONT_FAMILY,
    fontWeight: '500',
  },
  itemTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  itemBody: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySub: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
