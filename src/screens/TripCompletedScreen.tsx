import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { Check, MapPin, Receipt, Home, Star, Clock } from 'lucide-react-native';
import TripReceiptModal from '../components/TripReceiptModal';
import Button from '../components/Button';

/**
 * End of a booked ride, in two states driven by the backend payment status (BookingContext keeps
 * polling the booking until it is paid):
 *  - Reached destination: payment pending — the passenger pays the driver (cash, or GCash via the
 *    QR on the DRIVER's app) and waits; no Home/Rate yet.
 *  - Payment Successful: once the driver confirms — fare, method, Paid, then [Home] [Rate Driver].
 */
export default function TripCompletedScreen() {
  const {
    setScreenState,
    resetToHome,
    dropoff,
    fareEstimate,
    paymentMethod,
    latestReceipt,
    paymentStatus,
  } = useBooking();
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const isPaid = paymentStatus === 'paid';
  // Server figures from the completed booking (receipt), falling back to the booked quote.
  const fare = latestReceipt?.totalFare ?? fareEstimate.total;
  const distanceKm = latestReceipt?.distanceKm ?? fareEstimate.distanceKm;
  const farePerPassenger = latestReceipt?.farePerPassenger ?? fareEstimate.perPassengerFare;
  const passengerCount = latestReceipt?.passengerCount ?? fareEstimate.passengerCount;
  const methodLabel = paymentMethod === 'gcash' ? 'GCash' : 'Cash';

  if (isPaid) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.iconCircle, styles.iconCirclePaid]}>
            <Check size={34} color={COLORS.textInverse} strokeWidth={3} />
          </View>
          <Text style={styles.title}>Payment Successful</Text>
          <Text style={styles.subtitle}>Your trip to {dropoff.name} is complete.</Text>

          <View style={styles.summary}>
            <SummaryRow label="Fare" value={`₱${fare.toFixed(2)}`} strong />
            <SummaryRow label="Payment Method" value={methodLabel} />
            <SummaryRow label="Payment Status" value="Paid" paid />
          </View>

          <TouchableOpacity style={styles.receiptLink} onPress={() => setShowReceiptModal(true)} activeOpacity={0.7}>
            <Receipt size={16} color={COLORS.primary} />
            <Text style={styles.receiptLinkText}>View Official E-Receipt</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={resetToHome}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Home"
          >
            <Home size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.flex}>
            <Button label="Rate Driver" icon={Star} onPress={() => setScreenState('rate_review')} />
          </View>
        </View>

        <TripReceiptModal
          visible={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          receipt={latestReceipt}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconCircle}>
          <MapPin size={30} color={COLORS.textInverse} strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>You've reached your destination</Text>
        <Text style={styles.subtitle}>{dropoff.name}</Text>

        {/* Fare details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fare details</Text>
          <SummaryRow label="Distance" value={`${Number(distanceKm).toFixed(1)} km`} />
          <SummaryRow label="Fare per passenger" value={`₱${Number(farePerPassenger).toFixed(2)}`} />
          <SummaryRow label="Passengers" value={`× ${passengerCount}`} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total fare</Text>
            <Text style={styles.totalValue}>₱{fare.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment pending — status only; the driver collects and confirms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Payment</Text>
            <Text style={styles.methodText}>{methodLabel}</Text>
          </View>
          <Text style={styles.instruction}>
            {paymentMethod === 'gcash'
              ? 'Please pay the driver using the GCash QR shown by the driver, then give them the GCash reference number.'
              : 'Please pay the driver the total fare in cash.'}
          </Text>
          <View style={styles.waitingRow}>
            <Clock size={14} color={COLORS.primary} />
            <Text style={styles.waitingText}>Waiting for driver to confirm payment.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value, strong, paid }: { label: string; value: string; strong?: boolean; paid?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[strong ? styles.summaryValueStrong : styles.summaryValue, paid && styles.paidValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  iconCirclePaid: { backgroundColor: COLORS.success },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  section: {
    width: '100%',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: SPACING.xs },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  totalLabel: { ...TYPOGRAPHY.bodyLarge, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  methodText: { ...TYPOGRAPHY.body, fontWeight: '700', color: COLORS.primary },
  instruction: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.xs },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  waitingText: { ...TYPOGRAPHY.bodySmall, fontWeight: '600', color: COLORS.primary },
  summary: {
    width: '100%',
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: SPACING.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  summaryLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  summaryValue: { ...TYPOGRAPHY.bodyLarge, color: COLORS.textPrimary },
  summaryValueStrong: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  paidValue: { color: COLORS.success },
  receiptLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: SPACING.md },
  receiptLinkText: { ...TYPOGRAPHY.body, color: COLORS.primary, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  homeBtn: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
