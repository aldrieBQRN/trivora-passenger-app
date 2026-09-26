import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { Phone, MessageSquare, AlertTriangle, Star, MapPin } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import TrivoraMap from '../components/TrivoraMap';
import RideProgressStepper from '../components/RideProgressStepper';
import SOSModal from '../components/SOSModal';
import { useToast } from '../components/Toast';
import { callPhoneNumber, messagePhoneNumber } from '../utils/deviceContact';

interface ActiveRideScreenProps {
  topInset?: number;
}

export default function ActiveRideScreen({ topInset = 0 }: ActiveRideScreenProps) {
  const {
    activeDriver,
    fareEstimate,
    pickup,
    dropoff,
    paymentMethod,
    tripRemainingKm,
    routeCoordinates,
    routeSource,
    liveDriverLocation,
  } = useBooking();
  const { showToast } = useToast();

  const [showSosModal, setShowSosModal] = useState(false);

  // Measured from actual layout rather than guessed, so the map keeps the driver/route inside
  // the visible area between the status pill and the bottom panel.
  const [topOverlayHeight, setTopOverlayHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const handleTopLayout = (e: LayoutChangeEvent) => setTopOverlayHeight(e.nativeEvent.layout.height);
  const handleSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  const hasArrivedDestination = tripRemainingKm <= 0;
  const hasDriverPhone = !!activeDriver.mobile?.trim();

  const handleCall = async () => {
    const opened = await callPhoneNumber(activeDriver.mobile);
    if (!opened) showToast("Driver's phone number isn't available.", 'info');
  };

  const handleMessage = async () => {
    const opened = await messagePhoneNumber(activeDriver.mobile);
    if (!opened) showToast("Driver's phone number isn't available.", 'info');
  };

  return (
    <View style={styles.container}>
      {/* Full-bleed map — live ride tracking is the primary surface */}
      <TrivoraMap
        pickup={pickup}
        dropoff={dropoff}
        driverLocation={liveDriverLocation}
        routeCoordinates={routeCoordinates}
        routeSource={routeSource}
        suggestedRouteInfo={{
          distance: `${tripRemainingKm} km`,
          duration: `${fareEstimate.durationMinutes} min`,
        }}
        rideState="in_transit"
        showCompass={true}
        topInset={topInset + 10 + topOverlayHeight}
        bottomInset={sheetHeight}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating ride-status pill */}
      <View style={[styles.floatingTopWrap, { top: topInset + 10 }]} onLayout={handleTopLayout}>
        <View style={[styles.statusPill, hasArrivedDestination && styles.statusPillArrived]}>
          <View style={[styles.statusDot, hasArrivedDestination && styles.statusDotArrived]} />
          <Text style={styles.statusPillText}>
            {hasArrivedDestination ? `Arrived at ${dropoff.name}` : 'Ride in Progress'}
          </Text>
        </View>
      </View>

      {/* Driver, Fare & Safety Panel */}
      <View style={styles.sheet} onLayout={handleSheetLayout}>
        <View style={styles.profileRow}>
          <Avatar name={activeDriver.name} imageUri={activeDriver.avatarUrl} tone="driver" size={48} />

          <View style={styles.driverInfoCol}>
            <Text style={styles.driverName}>{activeDriver.name}</Text>
            <View style={styles.ratingSubRow}>
              <Star size={11} color={COLORS.amber} fill={COLORS.amber} />
              <Text style={styles.ratingText}>{activeDriver.rating}</Text>
              <Text style={styles.tripsText}>· {activeDriver.trips} rides</Text>
            </View>
            <Text style={styles.vehicleInfo}>
              {activeDriver.tricycle?.plateNumber
                ? `${activeDriver.tricycle.model || 'Tricycle'} • ${activeDriver.tricycle.plateNumber}`
                : 'Verified Tricycle'}
            </Text>
          </View>

          <View style={styles.fareCol}>
            <Text style={styles.fareAmount}>₱{fareEstimate.total.toFixed(2)}</Text>
            <Text style={styles.fareType}>{paymentMethod.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.destRow}>
          <MapPin size={14} color={COLORS.danger} />
          <Text style={styles.destText} numberOfLines={1}>
            {hasArrivedDestination ? 'You have reached your destination' : dropoff.name}
          </Text>
          {!hasArrivedDestination && (
            <Text style={styles.destRemaining}>{tripRemainingKm} km left</Text>
          )}
        </View>

        {/* Actions — SOS kept equally reachable and visually distinct */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, !hasDriverPhone && styles.actionBtnDisabled]}
            onPress={handleCall}
            activeOpacity={0.7}
            disabled={!hasDriverPhone}
          >
            <Phone size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, !hasDriverPhone && styles.actionBtnDisabled]}
            onPress={handleMessage}
            activeOpacity={0.7}
            disabled={!hasDriverPhone}
          >
            <MessageSquare size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sosBtn} onPress={() => setShowSosModal(true)} activeOpacity={0.8}>
            <AlertTriangle size={16} color={COLORS.danger} />
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        </View>

        <RideProgressStepper currentStep={hasArrivedDestination ? 'completed' : 'in_transit'} />
      </View>

      <SOSModal visible={showSosModal} onClose={() => setShowSosModal(false)} driver={activeDriver} />
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverInfoCol: {
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
  vehicleInfo: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 1,
  },
  fareCol: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
  },
  fareType: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.backgroundSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  destText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    flex: 1,
  },
  destRemaining: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.backgroundSubtle,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sosBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.dangerLight,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  sosBtnText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.danger,
  },
});
