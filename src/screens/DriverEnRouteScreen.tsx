import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutChangeEvent } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { Phone, MessageSquare, Share2, X, Star, CheckCircle2 } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import TrivoraMap from '../components/TrivoraMap';
import RideProgressStepper from '../components/RideProgressStepper';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { callPhoneNumber, messagePhoneNumber } from '../utils/deviceContact';

interface DriverEnRouteScreenProps {
  topInset?: number;
}

const FOUND_REVEAL_MS = 1700;

export default function DriverEnRouteScreen({ topInset = 0 }: DriverEnRouteScreenProps) {
  const {
    cancelBooking,
    activeDriver,
    pickup,
    matchedToda,
    driverDistanceKm,
    driverEtaMinutes,
    driverRouteCoordinates,
    driverRouteSource,
    liveDriverLocation,
  } = useBooking();
  const { showToast } = useToast();

  const [showFoundReveal, setShowFoundReveal] = useState(true);
  const foundAnim = useRef(new Animated.Value(0)).current;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Measured from actual layout rather than guessed — see ActiveRideScreen.
  const [topOverlayHeight, setTopOverlayHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const handleTopLayout = (e: LayoutChangeEvent) => setTopOverlayHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  const hasArrived = driverDistanceKm <= 0;

  // A short "Driver Found!" reveal the moment this screen mounts, before it
  // settles into the ongoing arriving/arrived status pill — a real moment
  // in the journey (stage 9) rather than a new state-machine state.
  useEffect(() => {
    Animated.spring(foundAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(foundAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        setShowFoundReveal(false)
      );
    }, FOUND_REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleShareTrip = () => {
    showToast('Live ride link copied — share with family or emergency contacts.', 'info');
  };

  const hasDriverPhone = !!activeDriver.mobile?.trim();

  const handleCall = async () => {
    const opened = await callPhoneNumber(activeDriver.mobile);
    if (!opened) showToast("Driver's phone number isn't available.", 'info');
  };

  const handleMessage = async () => {
    const opened = await messagePhoneNumber(activeDriver.mobile);
    if (!opened) showToast("Driver's phone number isn't available.", 'info');
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    await cancelBooking();
    setIsCancelling(false);
    setShowCancelConfirm(false);
  };

  return (
    <View style={styles.container}>
      {/* Full-bleed map — the driver's approach is the primary surface */}
      <TrivoraMap
        pickup={pickup}
        driverLocation={liveDriverLocation}
        routeCoordinates={driverRouteCoordinates}
        routeSource={driverRouteSource}
        suggestedRouteInfo={{
          distance: `${driverDistanceKm} km`,
          duration: `${driverEtaMinutes} min`,
        }}
        activeZone={matchedToda}
        rideState="driver_en_route"
        showTodaPill={false}
        showCompass={true}
        topInset={topInset + 10 + topOverlayHeight}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating status — a reveal moment, then a persistent small pill */}
      <View style={[styles.floatingTopWrap, { top: topInset + 10 }]} onLayout={handleTopLayout}>
        {showFoundReveal ? (
          <Animated.View
            style={[
              styles.foundPill,
              {
                opacity: foundAnim,
                transform: [
                  { scale: foundAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                ],
              },
            ]}
          >
            <CheckCircle2 size={16} color="#FFFFFF" />
            <Text style={styles.foundPillText}>Driver Found!</Text>
          </Animated.View>
        ) : (
          <View style={[styles.statusPill, hasArrived && styles.statusPillArrived]}>
            <View style={[styles.statusDot, hasArrived && styles.statusDotArrived]} />
            <Text style={styles.statusPillText}>
              {hasArrived
                ? `Driver arrived — meet at ${pickup.name}`
                : `Arriving in ${driverEtaMinutes} min`}
            </Text>
          </View>
        )}
      </View>

      {/* Driver & Ride Panel */}
      <View style={styles.sheet} onLayout={handleSheetLayout}>
        <View style={styles.driverRow}>
          <Avatar name={activeDriver.name} imageUri={activeDriver.avatarUrl} tone="driver" size={48} />

          <View style={styles.driverDetailsCol}>
            <Text style={styles.driverName}>{activeDriver.name}</Text>
            <View style={styles.ratingSubRow}>
              <Star size={11} color={COLORS.amber} fill={COLORS.amber} />
              <Text style={styles.ratingText}>{activeDriver.rating}</Text>
              <Text style={styles.tripsText}>· {activeDriver.trips} rides</Text>
            </View>
            <Text style={styles.todaName}>{activeDriver.todaName || 'TODA Bucana'}</Text>
          </View>

          <View style={styles.vehicleCol}>
            <View style={styles.platePill}>
              <Text style={styles.plateText}>{activeDriver.tricycle.plateNumber}</Text>
            </View>
            <Text style={styles.vehicleType}>Unit {activeDriver.tricycle.bodyNumber}</Text>
          </View>
        </View>

        <View style={styles.etaRow}>
          <Text style={styles.etaDistance}>
            {hasArrived ? 'Driver has Arrived' : `${driverDistanceKm} km away`}
          </Text>
          <Text style={styles.etaMinutes}>
            {hasArrived ? 'Waiting for you' : `${driverEtaMinutes} min`}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionItem, !hasDriverPhone && styles.actionItemDisabled]}
            onPress={handleCall}
            activeOpacity={0.7}
            disabled={!hasDriverPhone}
          >
            <View style={styles.actionIconBox}>
              <Phone size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, !hasDriverPhone && styles.actionItemDisabled]}
            onPress={handleMessage}
            activeOpacity={0.7}
            disabled={!hasDriverPhone}
          >
            <View style={styles.actionIconBox}>
              <MessageSquare size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleShareTrip} activeOpacity={0.7}>
            <View style={styles.actionIconBox}>
              <Share2 size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => setShowCancelConfirm(true)} activeOpacity={0.7}>
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.dangerLight }]}>
              <X size={18} color={COLORS.danger} />
            </View>
            <Text style={[styles.actionLabel, { color: COLORS.danger }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <RideProgressStepper currentStep={hasArrived ? 'arrived' : 'en_route'} />
      </View>

      <ConfirmModal
        visible={showCancelConfirm}
        title="Cancel Ride?"
        message="Are you sure you want to cancel this ride?"
        confirmLabel="Cancel Ride"
        cancelLabel="Keep Ride"
        destructive
        loading={isCancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSubtle,
  },
  floatingTopWrap: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    alignItems: 'center',
  },
  foundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  foundPillText: {
    ...TYPOGRAPHY.bodyLarge,
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  statusPillArrived: {
    backgroundColor: COLORS.successLight,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
  },
  statusDotArrived: {
    backgroundColor: COLORS.success,
  },
  statusPillText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: 12,
    ...SHADOWS.sheet,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  ratingSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  ratingText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tripsText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  todaName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 1,
  },
  vehicleCol: {
    alignItems: 'flex-end',
  },
  platePill: {
    backgroundColor: COLORS.backgroundSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: RADIUS.xs,
  },
  plateText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  vehicleType: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  etaDistance: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  etaMinutes: {
    ...TYPOGRAPHY.body,
    fontWeight: '800',
    color: COLORS.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionItemDisabled: {
    opacity: 0.4,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
  },
});
