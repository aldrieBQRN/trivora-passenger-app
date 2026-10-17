import React from 'react';
import { View, Text, Image, StyleSheet, SafeAreaView } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, FONT_FAMILY } from '../constants/theme';
import Button from '../components/Button';

interface OnboardingScreenProps {
  onGetStarted: () => void;
  onSkip?: () => void;
}

/**
 * Passenger Entry / Onboarding screen — single-page welcome matching the Driver app,
 * with Nasugbu location cue, brand logo, commuter value proposition, and a "Get Started" CTA.
 */
export default function OnboardingScreen({ onGetStarted }: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={styles.locationRow}>
          <MapPin size={12} color={COLORS.textMuted} strokeWidth={2.2} />
          <Text style={styles.locationText}>Nasugbu, Batangas</Text>
        </View>

        <Image
          source={require('../../assets/branding/trivora-logo-transparent.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />

        <View style={styles.rule} />

        <Text style={styles.tagline}>Ride with Ease.{'\n'}Connect with your Community.</Text>
        <Text style={styles.subtitle}>Official Municipal Tricycle Platform</Text>
      </View>

      <View style={styles.bottomBar}>
        <Button label="Get Started" onPress={onGetStarted} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xl,
  },
  locationText: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  brandLogo: {
    width: 220,
    height: 220,
    marginBottom: SPACING.sm,
  },
  rule: {
    width: 56,
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.lg,
  },
  tagline: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomBar: {
    gap: 12,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
});
