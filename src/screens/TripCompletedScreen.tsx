import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { MapPin, Banknote, Smartphone } from 'lucide-react-native';
import TripReceiptScreen from './TripReceiptScreen';
import PaymentSuccessView from '../components/PaymentSuccessView';

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
    return (
      <PaymentSuccessView
        destinationName={dropoff.name}
        fare={fare}
        paymentMethod={paymentMethod}
        paidLine={latestReceipt ? `${latestReceipt.date} · ${latestReceipt.time}` : 'Paid to your driver'}
        pickupName={latestReceipt?.pickup}
        dropoffName={latestReceipt?.dropoff}
        distanceKm={distanceKm}
        passengerCount={passengerCount}
        driverLine={latestReceipt?.driverName
          ? (latestReceipt.plateNumber ? `${latestReceipt.driverName} · ${latestReceipt.plateNumber}` : latestReceipt.driverName)
          : null}
        paymentReference={latestReceipt?.paymentReference}
        onViewReceipt={latestReceipt ? () => setShowReceipt(true) : undefined}
        onHome={resetToHome}
        onRate={() => setScreenState('rate_review')}
      />
    );
  }

  const isGcash = paymentMethod === 'gcash';
  const MethodIcon = isGcash ? Smartphone : Banknote;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.statusCircle}>
            <MapPin size={22} color={COLORS.textInverse} strokeWidth={2.4} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>You've reached your destination</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{dropoff.name}</Text>
          </View>
        </View>

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


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  // Same page padding and header as the Driver app's DriverFareCollectScreen.
  scrollContent: {
    padding: SPACING.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 4 },
  statusCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },
  subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 2 },
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
});
