import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { HistoryItem, TripReceipt } from '../types';
import { ChevronRight, Receipt, Star } from 'lucide-react-native';
import TripReceiptModal from '../components/TripReceiptModal';
import EmptyState from '../components/EmptyState';
import RouteSummaryStrip from '../components/RouteSummaryStrip';
import ScreenHeader from '../components/ScreenHeader';
import FilterTabs from '../components/FilterTabs';

interface HistoryScreenProps {
  onBackToMap?: () => void;
}

type FilterTab = 'All' | 'Completed' | 'Cancelled';

const FILTER_OPTIONS = [
  { key: 'All', label: 'All' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

export default function HistoryScreen({ onBackToMap: _onBackToMap }: HistoryScreenProps) {
  const { historyList, startRatingBooking } = useBooking();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectedReceipt, setSelectedReceipt] = useState<TripReceipt | null>(null);

  const filteredData = useMemo(
    () => historyList.filter((item) => activeFilter === 'All' || item.status === activeFilter),
    [historyList, activeFilter]
  );

  // Group by date — historyList is already newest-first (new trips are
  // prepended), so grouping in order needs no re-sorting.
  const sections = useMemo(() => {
    const byDate = new Map<string, HistoryItem[]>();
    filteredData.forEach((item) => {
      const bucket = byDate.get(item.date) || [];
      bucket.push(item);
      byDate.set(item.date, bucket);
    });
    return Array.from(byDate.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredData]);

  const openReceiptForHistory = (item: HistoryItem) => {
    if (item.status === 'Cancelled') return;
    setSelectedReceipt({
      bookingCode: item.bookingCode,
      date: item.date,
      // Real entries always carry their own real time now; the fallback only applies to the
      // handful of hardcoded legacy demo entries that predate this field.
      time: item.time || '10:15 AM',
      pickup: item.pickup,
      dropoff: item.dropoff,
      distanceKm: item.distanceKm,
      durationMinutes: item.durationMinutes,
      baseFare: 20.0,
      distanceFee: Math.max(0, item.fare - 20.0),
      totalFare: item.fare,
      paymentMethod: 'cash',
      driverName: item.driverName || 'Juan Dela Cruz',
      plateNumber: item.plateNumber || 'ABC 1234',
      bodyNumber: '04-128',
      todaName: 'TODA Bucana',
      mtopNumber: 'MTOP-2024-0089',
    });
  };

  const renderRideItem = ({ item }: { item: HistoryItem }) => {
    const isCompleted = item.status === 'Completed';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openReceiptForHistory(item)}
        activeOpacity={isCompleted ? 0.7 : 1}
      >
        <View style={styles.routeCol}>
          <RouteSummaryStrip variant="readonly" pickupLabel={item.pickup} dropoffLabel={item.dropoff} />
          {(!!item.driverName || !!item.time) && (
            <Text style={styles.metaText}>
              {item.driverName}
              {item.driverName && item.time ? ' · ' : ''}
              {item.time}
            </Text>
          )}
        </View>

        <View style={styles.fareStatusCol}>
          <Text style={[styles.fareAmount, !isCompleted && styles.fareAmountInert]}>
            ₱{item.fare.toFixed(2)}
          </Text>
          <View
            style={[
              styles.statusTag,
              { backgroundColor: isCompleted ? COLORS.successLight : COLORS.dangerLight },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isCompleted ? COLORS.emerald : COLORS.dangerDark },
              ]}
            >
              {item.status}
            </Text>
          </View>
          {isCompleted && (
            item.rating ? (
              <View style={styles.ratingRow}>
                <Star size={11} color={COLORS.amber} fill={COLORS.amber} />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => startRatingBooking(item.id)} activeOpacity={0.7}>
                <Text style={styles.rateLink}>Rate Driver</Text>
              </TouchableOpacity>
            )
          )}
          {isCompleted && <ChevronRight size={16} color={COLORS.textMuted} style={styles.chevron} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Plain title-only header, same treatment as the Driver app's inner pages — no
          subtitle or notification icon; that content belongs to Home, not a secondary page. */}
      <ScreenHeader title="Ride History" />

      {/* Filter — same segmented-tab design as the Driver app's Earnings screen */}
      <FilterTabs
        options={FILTER_OPTIONS}
        value={activeFilter}
        onChange={(key) => setActiveFilter(key as FilterTab)}
      />

      {/* Ride History List — grouped by date instead of repeating it per card */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRideItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.dateHeader}>{title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon={Receipt}
            title="No rides yet"
            subtitle={`You don't have any ${activeFilter === 'All' ? '' : activeFilter.toLowerCase() + ' '}rides on record.`}
          />
        }
      />

      {/* Trip Receipt Modal */}
      {selectedReceipt && (
        <TripReceiptModal
          visible={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          receipt={selectedReceipt}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    flexGrow: 1,
  },
  dateHeader: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  routeCol: {
    flex: 1,
  },
  metaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  fareStatusCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fareAmount: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  fareAmountInert: {
    color: COLORS.textSecondary,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  statusText: {
    ...TYPOGRAPHY.micro,
    fontSize: 9,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
  },
  rateLink: {
    ...TYPOGRAPHY.micro,
    color: COLORS.primary,
    fontWeight: '800',
  },
  chevron: {
    marginTop: 2,
  },
});
