import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Check, Receipt, Home, Star, Banknote, Smartphone, ChevronRight } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import Button from './Button';

interface PaymentSuccessViewProps {
  destinationName: string;
  fare: number;
  paymentMethod: string;
  /** Under the amount: the paid date/time when known, otherwise a plain fallback. */
  paidLine: string;
  /** Route block is shown only when both ends are known. */
  pickupName?: string | null;
  dropoffName?: string | null;
  distanceKm: number;
  passengerCount: number;
  driverLine?: string | null;
  paymentReference?: string | null;
  onViewReceipt?: () => void;
  onHome: () => void;
  onRate: () => void;
  /** Only for full-bleed callers (QR ride), where App.tsx doesn't pad the safe areas. */
  topInset?: number;
  bottomInset?: number;
}

/**
 * The "Payment Successful" page shared by a booked ride (TripCompletedScreen) and a QR walk-in
 * ride (QrRideScreen), so both end the same way: status header, green Total Paid card, trip
 * summary, then [Home] [Rate Driver]. Header/padding match the Driver app's Ride Completed page.
 */
export default function PaymentSuccessView({
  destinationName,
  fare,
  paymentMethod,
  paidLine,
  pickupName,
  dropoffName,
  distanceKm,
  passengerCount,
  driverLine,
  paymentReference,
  onViewReceipt,
  onHome,
  onRate,
  topInset = 0,
  bottomInset = 0,
}: PaymentSuccessViewProps) {
  const isGcash = paymentMethod === 'gcash';
  const MethodIcon = isGcash ? Smartphone : Banknote;
  const methodLabel = isGcash ? 'GCash' : 'Cash';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: SPACING.lg + topInset }]}>
        <View style={styles.header}>
          <View style={styles.statusCircle}>
            <Check size={24} color={COLORS.textInverse} strokeWidth={3} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>Payment Successful</Text>
            <Text style={styles.subtitle} numberOfLines={2}>Your trip to {destinationName} is complete.</Text>
          </View>
        </View>

        <View style={styles.fareCard}>
          <View style={styles.fareCardTop}>
            <Text style={styles.fareCardLabel}>TOTAL PAID</Text>
            <View style={styles.methodPill}>
              <MethodIcon size={13} color={COLORS.textInverse} />
              <Text style={styles.methodPillText}>{methodLabel}</Text>
            </View>
          </View>
          <Text style={styles.fareCardValue}>₱{fare.toFixed(2)}</Text>
          <Text style={styles.fareCardBreakdown}>{paidLine}</Text>
        </View>

        <View style={styles.card}>
          {pickupName && dropoffName ? (
            <View style={styles.routeBlock}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, styles.routeDotPickup]} />
                <Text style={styles.routeText} numberOfLines={1}>{pickupName}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, styles.routeDotDropoff]} />
                <Text style={styles.routeText} numberOfLines={1}>{dropoffName}</Text>
              </View>
            </View>
          ) : null}
          <SummaryRow label="Distance" value={`${Number(distanceKm).toFixed(1)} km`} />
          <SummaryRow label="Passengers" value={`${passengerCount}`} />
          {driverLine ? <SummaryRow label="Driver" value={driverLine} /> : null}
          {paymentReference ? <SummaryRow label="GCash reference" value={paymentReference} /> : null}
          <SummaryRow label="Payment status" value="Paid" paid />
        </View>

        {onViewReceipt ? (
          <TouchableOpacity style={styles.receiptLink} onPress={onViewReceipt} activeOpacity={0.7}>
            <View style={styles.cardIcon}>
              <Receipt size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.receiptLinkText}>View Official E-Receipt</Text>
            <ChevronRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: SPACING.md + bottomInset }]}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={onHome}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          <Home size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Button label="Rate Driver" icon={Star} onPress={onRate} />
        </View>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, paid }: { label: string; value: string; paid?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, paid && styles.paidValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 4 },
  statusCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 2 },
  fareCard: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  fareCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareCardLabel: { ...TYPOGRAPHY.label, color: COLORS.primaryTint },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
  },
  methodPillText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textInverse },
  fareCardValue: { ...TYPOGRAPHY.display, fontSize: 40, lineHeight: 46, color: COLORS.textInverse, marginTop: SPACING.sm },
  fareCardBreakdown: { ...TYPOGRAPHY.bodySmall, color: COLORS.primaryTint, marginTop: 2 },
  card: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm + 4,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBlock: { paddingBottom: SPACING.xs },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2 },
  routeDot: { width: 10, height: 10, borderRadius: RADIUS.full },
  routeDotPickup: { backgroundColor: COLORS.success },
  routeDotDropoff: { backgroundColor: COLORS.danger },
  routeLine: { width: 2, height: 14, marginLeft: 4, marginVertical: 2, backgroundColor: COLORS.border },
  routeText: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  summaryValue: { ...TYPOGRAPHY.body, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1, textAlign: 'right' },
  paidValue: { color: COLORS.success },
  receiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  receiptLinkText: { ...TYPOGRAPHY.body, color: COLORS.primary, fontWeight: '700', flex: 1 },
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
