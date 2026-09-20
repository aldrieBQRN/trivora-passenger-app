import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { TripReceipt } from '../types';
import { X, ShieldCheck, MapPin, Share2, CheckCircle2 } from 'lucide-react-native';
import { useToast } from './Toast';

interface TripReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  receipt: TripReceipt;
}

export default function TripReceiptModal({
  visible,
  onClose,
  receipt,
}: TripReceiptModalProps) {
  const { showToast } = useToast();

  const handleShare = () => {
    showToast(`Receipt ${receipt.bookingCode} exported — link saved to clipboard.`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <ShieldCheck size={20} color={COLORS.primary} />
              <Text style={styles.headerTitle}>Official E-Receipt</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody}>
            {/* Municipal Stamp Banner */}
            <View style={styles.stampCard}>
              <View style={styles.sealRow}>
                <View style={styles.sealBadge}>
                  <Text style={styles.sealText}>MUNICIPALITY OF NASUGBU</Text>
                  <Text style={styles.sealSub}>Tricycle Regulatory Board • MTOP</Text>
                </View>
              </View>

              <Text style={styles.bookingCodeText}>{receipt.bookingCode}</Text>
              <Text style={styles.dateTimeText}>
                {receipt.date} • {receipt.time}
              </Text>

              <View style={styles.certifiedPill}>
                <CheckCircle2 size={12} color={COLORS.success} />
                <Text style={styles.certifiedText}>Government Verified Transit Record</Text>
              </View>
            </View>

            {/* Route Summary */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Ride Itinerary</Text>

              <View style={styles.stopRow}>
                <MapPin size={15} color="#2563EB" />
                <View style={styles.stopDetails}>
                  <Text style={styles.stopMicro}>Pick-up</Text>
                  <Text style={styles.stopAddress}>{receipt.pickup}</Text>
                </View>
              </View>

              <View style={styles.stopLine} />

              <View style={styles.stopRow}>
                <MapPin size={15} color={COLORS.danger} />
                <View style={styles.stopDetails}>
                  <Text style={styles.stopMicro}>Destination</Text>
                  <Text style={styles.stopAddress}>{receipt.dropoff}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Text style={styles.metricsText}>
                  Distance: <Text style={styles.boldVal}>{receipt.distanceKm} km</Text>
                </Text>
                <Text style={styles.metricsText}>
                  Duration: <Text style={styles.boldVal}>{receipt.durationMinutes} min</Text>
                </Text>
              </View>
            </View>

            {/* Fare Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Fare Computation</Text>

              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Distance Fee ({receipt.distanceKm} km x ₱5.00)</Text>
                <Text style={styles.fareValue}>₱{receipt.distanceFee.toFixed(2)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>Total Amount Paid</Text>
                  <Text style={styles.paymentMethodLabel}>
                    Method: {receipt.paymentMethod.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.totalAmount}>₱{receipt.totalFare.toFixed(2)}</Text>
              </View>
            </View>

            {/* Operator & Franchise Info */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Operator & Unit Information</Text>

              <View style={styles.infoGrid}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Authorized Driver</Text>
                  <Text style={styles.gridVal}>{receipt.driverName}</Text>
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>TODA Zone</Text>
                  <Text style={styles.gridVal}>{receipt.todaName}</Text>
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Plate Number</Text>
                  <Text style={styles.gridVal}>{receipt.plateNumber}</Text>
                </View>

                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>MTOP Franchise #</Text>
                  <Text style={styles.gridVal}>{receipt.mtopNumber}</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
                <Share2 size={16} color={COLORS.primary} />
                <Text style={styles.shareBtnText}>Share E-Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.88}>
                <Text style={styles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '90%',
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
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: 14,
  },
  stampCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceInput,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  sealRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  sealBadge: {
    alignItems: 'center',
  },
  sealText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  sealSub: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  bookingCodeText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  dateTimeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  certifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    marginTop: 4,
  },
  certifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopDetails: {
    flex: 1,
  },
  stopMicro: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
  },
  stopAddress: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stopLine: {
    width: 1.5,
    height: 14,
    backgroundColor: COLORS.border,
    marginLeft: 7,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    marginTop: 4,
  },
  metricsText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  boldVal: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  fareValue: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  paymentMethodLabel: {
    ...TYPOGRAPHY.micro,
    color: COLORS.primary,
  },
  totalAmount: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
  },
  gridLabel: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
  },
  gridVal: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  shareBtn: {
    flex: 1,
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  doneBtn: {
    flex: 1,
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textInverse,
  },
});
