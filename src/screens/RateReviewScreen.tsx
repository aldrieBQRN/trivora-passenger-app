import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useBooking } from '../context/BookingContext';
import { ArrowLeft, Star } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import Button from '../components/Button';

const COMPLIMENT_TAGS = ['Safe Driving', 'Courteous', 'Clean Trike', 'On-time', 'Friendly'];

export default function RateReviewScreen() {
  const {
    finishReview,
    resetToHome,
    activeDriver,
    selectedRating,
    setSelectedRating,
    reviewComment,
    setReviewComment,
    selectedCompliments,
    toggleCompliment,
  } = useBooking();
  const { showToast } = useToast();
  // finishReview() navigates away (setScreenState('home')) once it's called, but that transition
  // isn't instant — this guards against a rapid double-tap firing a second submission before it
  // resolves (on top of the backend's own ride_ratings.booking_id unique constraint).
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getRatingFeedback = (stars: number) => {
    switch (stars) {
      case 5:
        return 'Outstanding ride!';
      case 4:
        return 'Great ride!';
      case 3:
        return 'Average ride';
      case 2:
        return 'Could be better';
      default:
        return 'Poor experience';
    }
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    finishReview();
    showToast('Thanks for your feedback — it helps keep TODA operators accountable.');
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={resetToHome} activeOpacity={0.7}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Driver</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Driver Profile Row */}
          <View style={styles.driverProfileCard}>
            <Avatar name={activeDriver.name} imageUri={activeDriver.avatarUrl} tone="driver" size={52} />
            <View style={styles.driverMetaCol}>
              <Text style={styles.driverName}>{activeDriver.name}</Text>
              <Text style={styles.driverSub}>
                {activeDriver.todaName} • {activeDriver.tricycle.plateNumber}
              </Text>
            </View>
          </View>

          {/* 5-Star Rating Selector */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setSelectedRating(star)}
                activeOpacity={0.7}
                style={styles.starBtn}
              >
                <Star
                  size={36}
                  color={star <= selectedRating ? COLORS.amber : COLORS.border}
                  fill={star <= selectedRating ? COLORS.amber : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>{getRatingFeedback(selectedRating)}</Text>

          {/* Compliment Chips */}
          <View style={styles.chipsContainer}>
            {COMPLIMENT_TAGS.map((tag) => {
              const isSelected = selectedCompliments.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleCompliment(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Comment Text Area */}
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment (optional)..."
            placeholderTextColor={COLORS.textMuted}
            value={reviewComment}
            onChangeText={setReviewComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dominant Submit Review Button */}
      <View style={styles.bottomBar}>
        <Button label="Submit Review" onPress={handleSubmit} loading={isSubmitting} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  scrollContent: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  driverProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xl,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  driverMetaCol: {
    justifyContent: 'center',
  },
  driverName: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  driverSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabel: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
    width: '100%',
  },
  chip: {
    backgroundColor: COLORS.surfaceInput,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primaryTint,
    borderColor: COLORS.primary,
  },
  chipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  commentInput: {
    width: '100%',
    backgroundColor: COLORS.surfaceInput,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 90,
  },
  bottomBar: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.sheet,
  },
});
