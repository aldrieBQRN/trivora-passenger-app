import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { Check, Receipt } from 'lucide-react-native';
import TripReceiptModal from '../components/TripReceiptModal';
import Button from '../components/Button';
import RouteSummaryStrip from '../components/RouteSummaryStrip';

export default function TripCompletedScreen() {
  const { setScreenState, resetToHome, pickup, dropoff, fareEstimate, paymentMethod, latestReceipt } =
    useBooking();
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const checkScale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 60 }).start();
  }, [checkScale]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
          <Check size={36} color="#FFFFFF" strokeWidth={3} />
        </Animated.View>

        <Text style={styles.title}>Thank you for riding with us!</Text>

        {/* Fare is the hero number — everything else supports it */}
        <View style={styles.fareHero}>
          <Text style={styles.fareHeroValue}>₱{fareEstimate.total.toFixed(2)}</Text>
          <Text style={styles.fareHeroLabel}>
            Paid via {paymentMethod === 'gcash' ? 'GCash e-Wallet' : 'Cash'} · {latestReceipt.date}
          </Text>
        </View>

        {/* Compact route recap, same visual language as the rest of the journey */}
        <View style={styles.routeCard}>
          <RouteSummaryStrip variant="readonly" pickupLabel={pickup.name} dropoffLabel={dropoff.name} />
        </View>

        {/* One dominant action, one secondary, one tertiary — not three equals */}
        <View style={styles.actionsCol}>
          <View style={styles.primaryActionGroup}>
            <Button label="Rate Your Driver" onPress={() => setScreenState('rate_review')} />
            <Text style={styles.rateCaption}>Help keep TODA operators accountable</Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => setShowReceiptModal(true)}
            activeOpacity={0.7}
          >
            <Receipt size={16} color={COLORS.primary} />
            <Text style={styles.secondaryActionText}>View Official E-Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneLink} onPress={resetToHome} activeOpacity={0.7}>
            <Text style={styles.doneText}>Back to Home</Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  content: {
    alignItems: 'center',
  },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  fareHero: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  fareHeroValue: {
    ...TYPOGRAPHY.display,
    color: COLORS.primary,
  },
  fareHeroLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  routeCard: {
    width: '100%',
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  actionsCol: {
    width: '100%',
    gap: SPACING.sm,
  },
  primaryActionGroup: {
    gap: 6,
  },
  rateCaption: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  secondaryActionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '700',
  },
  doneLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  doneText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
});
