import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { TripReceipt } from '../types';
import { Share2, CheckCircle2, Banknote, Smartphone, Clock } from 'lucide-react-native';
import { useToast } from '../components/Toast';
import Button from '../components/Button';
import RouteSummaryStrip from '../components/RouteSummaryStrip';
import { shareText } from '../utils/shareTrip';
import ScreenHeader from '../components/ScreenHeader';

interface TripReceiptScreenProps {
  onBack: () => void;
  receipt: TripReceipt;
}

const peso = (n: number) => `₱${n.toFixed(2)}`;

/**
 * Trip e-receipt page (Ride History and the completed-trip flow): the amount paid up top, then
 * the trip, the fare computation and the driver/unit details, each as plain label-value rows.
 * Fields with nothing on record show "—" — values are never invented.
 */
export default function TripReceiptScreen({ onBack, receipt }: TripReceiptScreenProps) {
  const { showToast } = useToast();
  const isGcash = receipt.paymentMethod === 'gcash';
  const methodLabel = isGcash ? 'GCash' : 'Cash';
  // Unknown status (older receipts) counts as paid, as before; a known non-paid status doesn't.
  const isPaid = !receipt.paymentStatus || receipt.paymentStatus === 'paid';

  const handleShare = async () => {
    const message = [
      `Trivora e-receipt ${receipt.bookingCode}`,
      `${receipt.date} · ${receipt.time}`,
      `From: ${receipt.pickup}`,
      `To: ${receipt.dropoff}`,
      `${isPaid ? 'Total paid' : 'Fare'}: ${peso(receipt.totalFare)} (${methodLabel}${isPaid ? '' : ', payment pending'})`,
      receipt.driverName ? `Driver: ${receipt.driverName}` : null,
      receipt.plateNumber ? `Plate No.: ${receipt.plateNumber}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const result = await shareText(`Trivora e-receipt ${receipt.bookingCode}`, message);
    if (result === 'copied') showToast('Receipt copied to clipboard.');
    else if (result === 'unavailable') showToast("Couldn't share the receipt on this device.", 'info');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="E-Receipt" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Amount paid */}
        <View style={styles.hero}>
          <Text style={styles.heroMeta}>Municipality of Nasugbu · Tricycle Regulatory Board</Text>
          <Text style={styles.heroLabel}>{isPaid ? 'Total paid' : 'Fare'}</Text>
          <Text style={styles.heroAmount}>{peso(receipt.totalFare)}</Text>
          {isPaid ? (
            <View style={styles.paidPill}>
              <CheckCircle2 size={13} color={COLORS.emerald} />
              <Text style={styles.paidPillText}>Paid via {methodLabel}</Text>
            </View>
          ) : (
            <View style={[styles.paidPill, styles.pendingPill]}>
              <Clock size={13} color={COLORS.warning} />
              <Text style={[styles.paidPillText, styles.pendingPillText]}>Payment pending · {methodLabel}</Text>
            </View>
          )}
          <Text style={styles.heroMeta}>
            {receipt.bookingCode} · {receipt.date} · {receipt.time}
          </Text>
        </View>

        {/* Trip */}
        <Section title="Trip">
          <RouteSummaryStrip variant="readonly" pickupLabel={receipt.pickup} dropoffLabel={receipt.dropoff} />
          <Row label="Distance" value={`${Number(receipt.distanceKm).toFixed(1)} km`} />
          {receipt.durationMinutes > 0 ? <Row label="Duration" value={`~${receipt.durationMinutes} min`} /> : null}
        </Section>

        {/* Fare — base covers the first 4 km; each km beyond adds ₱5 per passenger. */}
        <Section title="Fare">
          <Row
            label={receipt.passengerCount === 1 ? 'Base fare (first 4 km)' : 'Base fare (first 4 km, per passenger)'}
            value={peso(receipt.baseFare)}
          />
          {receipt.distanceKm > 4 && (
            <Row label="Additional distance (per passenger)" value={peso(receipt.distanceFee)} />
          )}
          <Row label="Fare per passenger" value={peso(receipt.farePerPassenger)} />
          <Row label="Passengers" value={`× ${receipt.passengerCount}`} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{peso(receipt.totalFare)}</Text>
          </View>
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Method</Text>
            <View style={styles.methodValue}>
              {isGcash ? <Smartphone size={14} color={COLORS.primary} /> : <Banknote size={14} color={COLORS.primary} />}
              <Text style={styles.rowValue}>{methodLabel}</Text>
            </View>
          </View>
          {isGcash && receipt.paymentReference ? <Row label="GCash reference" value={receipt.paymentReference} /> : null}
        </Section>

        {/* Driver & unit */}
        <Section title="Driver & tricycle">
          <Row label="Driver" value={receipt.driverName || '—'} />
          <Row label="Plate number" value={receipt.plateNumber || '—'} />
          <Row label="Sticker number" value={receipt.codingNumber || '—'} />
          {receipt.mtopNumber ? <Row label="MTOP franchise no." value={receipt.mtopNumber} /> : null}
        </Section>
      </ScrollView>

      {/* Actions pinned to the bottom */}
      <View style={styles.footer}>
        <View style={styles.flex}>
          <Button label="Share" icon={Share2} variant="secondary" onPress={handleShare} />
        </View>
        <View style={styles.flex}>
          <Button label="Done" onPress={onBack} />
        </View>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },

  // Amount paid
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundSubtle,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  heroLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  heroAmount: { ...TYPOGRAPHY.display, color: COLORS.textPrimary },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successLight,
  },
  paidPillText: { ...TYPOGRAPHY.caption, fontWeight: '600', color: COLORS.emerald },
  pendingPill: { backgroundColor: COLORS.warningLight },
  pendingPillText: { color: COLORS.warning },
  heroMeta: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  // Sections
  section: { gap: SPACING.xs },
  sectionTitle: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    minHeight: 32,
  },
  rowLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, flexShrink: 1 },
  rowValue: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary, flexShrink: 1, textAlign: 'right' },
  methodValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm + 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  totalLabel: { ...TYPOGRAPHY.bodyLarge, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { ...TYPOGRAPHY.h2, color: COLORS.textPrimary },

  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm + 4,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
});