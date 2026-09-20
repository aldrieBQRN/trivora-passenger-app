import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, BUTTONS, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../components/Toast';
import { passengerApi } from '../services/api';
import { ReportCategory, ReportItem, ReportStatus } from '../types';
import {
  Car,
  Bike,
  Wallet,
  Route,
  MapPinOff,
  Ellipsis,
  MessageSquareWarning,
  Check,
} from 'lucide-react-native';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import FilterTabs from '../components/FilterTabs';

type ReportsTab = 'my_reports' | 'new_report';

const REPORTS_TAB_OPTIONS = [
  { key: 'my_reports', label: 'My Reports' },
  { key: 'new_report', label: 'Report a Concern' },
];

const CATEGORY_OPTIONS: { key: ReportCategory; label: string; icon: typeof Car }[] = [
  { key: 'driver', label: 'Driver Concern', icon: Car },
  { key: 'vehicle', label: 'Vehicle / Tricycle Concern', icon: Bike },
  { key: 'fare', label: 'Fare Concern', icon: Wallet },
  { key: 'booking', label: 'Booking Concern', icon: Route },
  { key: 'pickup_dropoff', label: 'Pick-up / Destination Concern', icon: MapPinOff },
  { key: 'other', label: 'Other', icon: Ellipsis },
];

const CATEGORY_LABELS: Record<ReportCategory, string> = CATEGORY_OPTIONS.reduce(
  (acc, opt) => ({ ...acc, [opt.key]: opt.label }),
  {} as Record<ReportCategory, string>
);

const STATUS_META: Record<ReportStatus, { label: string; bg: string; fg: string }> = {
  submitted: { label: 'Submitted', bg: COLORS.amberLight, fg: COLORS.amber },
  under_review: { label: 'Under Review', bg: COLORS.skyLight, fg: COLORS.sky },
  resolved: { label: 'Resolved', bg: COLORS.emeraldLight, fg: COLORS.emerald },
};

const MIN_DESCRIPTION_LENGTH = 10;

function formatSubmittedDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const { historyList } = useBooking();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ReportsTab>('my_reports');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<{ category?: string; description?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const completedTrips = historyList.filter((item) => item.status === 'Completed');

  const loadReports = useCallback(async () => {
    if (!user?.id) {
      setLoadingReports(false);
      return;
    }
    setLoadingReports(true);
    setLoadError(null);
    try {
      const data: any = await passengerApi.getReports(user.id);
      const mapped: ReportItem[] = (data?.reports || []).map((r: any) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        status: r.status,
        bookingId: r.booking_id ?? null,
        bookingPickup: r.booking?.pickup_name ?? null,
        bookingDropoff: r.booking?.dropoff_name ?? null,
        createdAt: r.created_at,
      }));
      setReports(mapped);
    } catch (err: any) {
      if (err?.status !== undefined) {
        // The backend was reached and rejected the request outright — a real failure worth
        // surfacing, not a connectivity issue.
        setLoadError(err.message || 'Could not load your reports. Please try again.');
      } else {
        // Backend unreachable (e.g. offline dev environment) — degrade to an empty list instead
        // of a raw "Failed to fetch" error, matching how the rest of the app tolerates a missing
        // backend rather than showing a technical network message.
        setReports([]);
      }
    } finally {
      setLoadingReports(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const resetForm = () => {
    setCategory(null);
    setDescription('');
    setSelectedTripId(null);
    setFormErrors({});
  };

  const handleSubmit = async () => {
    const nextErrors: { category?: string; description?: string } = {};
    if (!category) nextErrors.category = 'Select a concern category';
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      nextErrors.description = `Describe your concern in at least ${MIN_DESCRIPTION_LENGTH} characters`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }
    if (!user?.id) {
      showToast('You need to be signed in to submit a concern');
      return;
    }

    setSubmitting(true);
    try {
      await passengerApi.submitReport({
        user_id: user.id,
        category: category as ReportCategory,
        description: description.trim(),
        booking_id: selectedTripId,
      });
      showToast('Concern submitted successfully');
      resetForm();
      setActiveTab('my_reports');
      loadReports();
    } catch (err: any) {
      showToast(err?.message || 'Could not submit your concern. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderMyReports = () => {
    if (loadingReports) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.centerState}>
          <EmptyState icon={MessageSquareWarning} title="Couldn't load reports" subtitle={loadError} />
          <TouchableOpacity style={styles.retryBtn} onPress={loadReports} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (reports.length === 0) {
      return (
        <EmptyState
          icon={MessageSquareWarning}
          title="No reports yet"
          subtitle="Concerns you submit about a driver, fare, or ride will appear here."
        />
      );
    }

    return (
      <View>
        {reports.map((report) => {
          const meta = STATUS_META[report.status];
          return (
            <View key={report.id} style={styles.row}>
              <View style={styles.reportCol}>
                <Text style={styles.reportCategory}>{CATEGORY_LABELS[report.category]}</Text>
                <Text style={styles.reportDescription} numberOfLines={2}>
                  {report.description}
                </Text>
                {report.bookingPickup && report.bookingDropoff && (
                  <Text style={styles.metaText} numberOfLines={1}>
                    Ride: {report.bookingPickup} → {report.bookingDropoff}
                  </Text>
                )}
              </View>

              <View style={styles.statusCol}>
                <View style={[styles.statusTag, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
                <Text style={styles.metaText}>{formatSubmittedDate(report.createdAt)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderNewReport = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formSectionLabel}>Category</Text>
      <View style={styles.categoryList}>
        {CATEGORY_OPTIONS.map((option) => {
          const isActive = category === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.categoryRow, isActive && styles.categoryRowActive]}
              onPress={() => {
                setCategory(option.key);
                if (formErrors.category) setFormErrors((prev) => ({ ...prev, category: undefined }));
              }}
              activeOpacity={0.8}
            >
              <option.icon size={18} color={isActive ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                {option.label}
              </Text>
              {isActive && <Check size={16} color={COLORS.primary} style={styles.categoryCheck} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {formErrors.category ? <Text style={styles.errorText}>{formErrors.category}</Text> : null}

      {completedTrips.length > 0 && (
        <>
          <Text style={styles.formSectionLabel}>Related Ride (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tripScroll}>
            <TouchableOpacity
              style={[styles.tripChip, selectedTripId === null && styles.tripChipActive]}
              onPress={() => setSelectedTripId(null)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tripChipText, selectedTripId === null && styles.tripChipTextActive]}>
                None
              </Text>
            </TouchableOpacity>
            {completedTrips.slice(0, 10).map((trip) => {
              const tripId = typeof trip.id === 'number' ? trip.id : null;
              const isActive = tripId !== null && selectedTripId === tripId;
              return (
                <TouchableOpacity
                  key={String(trip.id)}
                  style={[styles.tripChip, isActive && styles.tripChipActive]}
                  onPress={() => setSelectedTripId(tripId)}
                  activeOpacity={0.8}
                  disabled={tripId === null}
                >
                  <Text style={[styles.tripChipText, isActive && styles.tripChipTextActive]} numberOfLines={1}>
                    {trip.dropoff} · {trip.date}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      <Text style={styles.formSectionLabel}>Description</Text>
      <View style={[styles.descriptionBox, formErrors.description && styles.descriptionBoxError]}>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe what happened, including relevant details like time, location, or names."
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: undefined }));
          }}
          multiline
          textAlignVertical="top"
          editable={!submitting}
        />
      </View>
      {formErrors.description ? <Text style={styles.errorText}>{formErrors.description}</Text> : null}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        activeOpacity={0.9}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Concern'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Plain title-only header, same treatment as the Driver app's inner pages — no
          subtitle or notification icon; that content belongs to Home, not a secondary page. */}
      <ScreenHeader title="Reports & Concerns" />

      <FilterTabs
        options={REPORTS_TAB_OPTIONS}
        value={activeTab}
        onChange={(key) => setActiveTab(key as ReportsTab)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'my_reports' ? renderMyReports() : renderNewReport()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
    flexGrow: 1,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryTint,
  },
  retryBtnText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '800',
  },
  // Row treatment matches HistoryScreen's ride rows exactly (same padding, divider, gap) — a
  // plain divided list instead of individual floating cards.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  reportCol: {
    flex: 1,
  },
  reportCategory: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  reportDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  metaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statusCol: {
    alignItems: 'flex-end',
    gap: 4,
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
  formContainer: {
    gap: SPACING.sm,
  },
  formSectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginLeft: 2,
  },
  categoryList: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceInput,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryRowActive: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  categoryLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    flex: 1,
  },
  categoryLabelActive: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  categoryCheck: {
    marginLeft: 4,
  },
  tripScroll: {
    marginTop: -2,
  },
  tripChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    maxWidth: 200,
  },
  tripChipActive: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  tripChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  tripChipTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  descriptionBox: {
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 110,
    padding: 14,
  },
  descriptionBoxError: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  descriptionInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.dangerDark,
    marginLeft: 2,
  },
  submitBtn: {
    height: BUTTONS.touchHeight,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...TYPOGRAPHY.h3,
    color: '#FFFFFF',
  },
});
