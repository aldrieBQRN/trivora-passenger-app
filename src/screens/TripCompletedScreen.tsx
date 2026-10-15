import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { Check, MapPin, Receipt, Home, Star, Banknote, Smartphone, ChevronRight } from 'lucide-react-native';
import TripReceiptScreen from './TripReceiptScreen';
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
  const [showReceipt, setShowReceipt] = useState(false);

  const isPaid = paymentStatus === 'paid';
  // Server figures from the completed booking (receipt), falling back to the booked quote.
  const fare = latestReceipt?.totalFare ?? fareEstimate.total;
  const distanceKm = latestReceipt?.distanceKm ?? fareEstimate.distanceKm;
  const farePerPassenger = latestReceipt?.farePerPassenger ?? fareEstimate.perPassengerFare;
  const passengerCount = latestReceipt?.passengerCount ?? fareEstimate.passengerCount;
  const methodLabel = paymentMethod === 'gcash' ? 'GCash' : 'Cash';

  // The e-receipt is a full page, not a sheet — it replaces the completed-trip screen.
  if (showReceipt && latestReceipt) {
    return <TripReceiptScreen onBack={() => setShowReceipt(false)} receipt={latestReceipt} />;
  }

  if (isPaid) {
    const PaidMethodIcon = paymentMethod === 'gcash' ? Smartphone : Banknote;
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.successHalo}>
            <View style={[styles.iconCircle, styles.iconCirclePaid]}>
              <Check size={34} color={COLORS.textInverse} strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.title}>Payment Successful</Text>
          <Text style={styles.subtitle}>Your trip to {dropoff.name} is complete.</Text>

          {/* Total paid — the green twin of the navy "Amount to pay" card */}
          <View style={[styles.fareCard, styles.fareCardPaid]}>
            <View style={styles.fareCardTop}>
              <Text style={styles.fareCardLabel}>TOTAL PAID</Text>
              <View style={styles.methodPill}>
                <PaidMethodIcon size={13} color={COLORS.textInverse} />
                <Text style={styles.methodPillText}>{methodLabel}</Text>
              </View>
            </View>
            <Text style={styles.fareCardValue}>₱{fare.toFixed(2)}</Text>
            <Text style={styles.fareCardBreakdown}>
              {latestReceipt ? `${latestReceipt.date} · ${latestReceipt.time}` : 'Paid to your driver'}
            </Text>
          </View>

          {/* Trip summary — route, driver and reference only when the receipt has them */}
          <View style={styles.card}>
            {latestReceipt ? (
              <View style={styles.routeBlock}>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, styles.routeDotPickup]} />
                  <Text style={styles.routeText} numberOfLines={1}>{latestReceipt.pickup}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, styles.routeDotDropoff]} />
                  <Text style={styles.routeText} numberOfLines={1}>{latestReceipt.dropoff}</Text>
                </View>
              </View>
            ) : null}
            <SummaryRow label="Distance" value={`${Number(distanceKm).toFixed(1)} km`} />
            <SummaryRow label="Passengers" value={`${passengerCount}`} />
            {latestReceipt?.driverName ? (
              <SummaryRow
                label="Driver"
                value={latestReceipt.plateNumber ? `${latestReceipt.driverName} · ${latestReceipt.plateNumber}` : latestReceipt.driverName}
              />
            ) : null}
            {latestReceipt?.paymentReference ? (
              <SummaryRow label="GCash reference" value={latestReceipt.paymentReference} />
            ) : null}
            <SummaryRow label="Payment status" value="Paid" paid />
          </View>

          {latestReceipt ? (
            <TouchableOpacity style={styles.receiptLink} onPress={() => setShowReceipt(true)} activeOpacity={0.7}>
              <View style={styles.cardIcon}>
                <Receipt size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.receiptLinkText}>View Official E-Receipt</Text>
              <ChevronRight size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
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
      </View>
    );
  }

  const isGcash = paymentMethod === 'gcash';
  const MethodIcon = isGcash ? Smartphone : Banknote;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconCircle}>
          <MapPin size={30} color={COLORS.textInverse} strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>You've reached your destination</Text>
        <Text style={styles.subtitle}>{dropoff.name}</Text>

        {/* Amount to pay — same navy fare card the driver sees on Collect Payment */}
        <View style={styles.fareCard}>
          <View style={styles.fareCardTop}>
            <Text style={styles.fareCardLabel}>AMOUNT TO PAY</Text>
            <View style={styles.methodPill}>
              <MethodIcon size={13} color={COLORS.textInverse} />
              <Text style={styles.methodPillText}>{methodLabel}</Text>
            </View>
          </View>
          <Text style={styles.fareCardValue}>₱{fare.toFixed(2)}</Text>
          <Text style={styles.fareCardBreakdown}>
            ₱{Number(farePerPassenger).toFixed(2)} × {passengerCount} passenger{passengerCount !== 1 ? 's' : ''} · {Number(distanceKm).toFixed(1)} km
          </Text>
        </View>

        {/* How to pay — status only; the driver collects and confirms */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <MethodIcon size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.cardTitle}>Pay with {methodLabel}</Text>
          </View>
          {isGcash ? (
            <>
              <PayStep step={1} text="Scan the GCash QR on the driver's phone." />
              <PayStep step={2} text={`Send ₱${fare.toFixed(2)} in your GCash app.`} />
              <PayStep step={3} text="Tell the driver your GCash reference number." />
            </>
          ) : (
            <Text style={styles.instruction}>Hand the driver ₱{fare.toFixed(2)} in cash. They'll confirm it and give any change.</Text>
          )}
        </View>

        <View style={styles.waitingPill}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <View style={styles.flex}>
            <Text style={styles.waitingText}>Waiting for driver to confirm payment.</Text>
            <Text style={styles.waitingHint}>This updates automatically.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PayStep({ step, text }: { step: number; text: string }) {
  return (
    <View style={styles.payStep}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{step}</Text>
      </View>
      <Text style={styles.payStepText}>{text}</Text>
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
  iconCirclePaid: { backgroundColor: COLORS.success, marginBottom: 0 },
  successHalo: {
    width: 92,
    height: 92,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  fareCard: {
    width: '100%',
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
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
    width: '100%',
    marginTop: SPACING.md,
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm + 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...TYPOGRAPHY.bodyLarge, fontWeight: '700', color: COLORS.textPrimary },
  instruction: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  payStep: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textInverse },
  payStepText: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, flex: 1 },
  waitingPill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryTint,
  },
  waitingText: { ...TYPOGRAPHY.bodySmall, fontWeight: '700', color: COLORS.primary },
  waitingHint: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
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
    width: '100%',
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
  fareCardPaid: { backgroundColor: COLORS.success },
  routeBlock: { paddingBottom: SPACING.xs },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2 },
  routeDot: { width: 10, height: 10, borderRadius: RADIUS.full },
  routeDotPickup: { backgroundColor: COLORS.success },
  routeDotDropoff: { backgroundColor: COLORS.danger },
  routeLine: { width: 2, height: 14, marginLeft: 4, marginVertical: 2, backgroundColor: COLORS.border },
  routeText: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    // App.tsx already reserves the device's bottom safe area — this keeps the buttons off that edge.
    paddingBottom: SPACING.md,
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
