import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, TYPOGRAPHY } from '../constants/theme';
import Button from '../components/Button';

interface OnboardingScreenProps {
  onGetStarted: () => void;
  onSkip: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Each slide's copy maps directly to a real stage of the app's own booking flow (Home's "Book a
// Tricycle" -> SearchingDriversScreen -> ActiveRideScreen), not generic onboarding filler — and
// the filenames were fixed by the finalized image generation, so the copy follows that order.
const SLIDES = [
  {
    key: 'book',
    image: require('../../assets/onboarding/onboarding-1-book-a-ride.png'),
    title: 'Book a Ride in Seconds',
    description: 'Request a tricycle to anywhere in Nasugbu — fixed municipal fares, no haggling.',
  },
  {
    key: 'finding',
    image: require('../../assets/onboarding/onboarding-2-finding-a-ride.png'),
    title: "We'll Find You a Driver",
    description: 'Get matched with a verified TODA tricycle nearby and track them on the way.',
  },
  {
    key: 'journey',
    image: require('../../assets/onboarding/onboarding-3-the-journey.png'),
    title: 'Ride Safely, Arrive Easily',
    description: 'Live ride sharing and one-tap SOS keep every ride safe from pick-up to destination.',
  },
];

/** A soft, controlled darkening confined to the lower portion of the photo — not a full-screen
 * or brightly-colored gradient — just enough for the overlaid text to stay legible regardless of
 * how light the underlying photograph is at that point. */
const SCRIM_HEIGHT = SCREEN_HEIGHT * 0.38;

function BottomScrim() {
  return (
    <Svg width={SCREEN_WIDTH} height={SCRIM_HEIGHT} style={styles.scrim}>
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1220" stopOpacity={0} />
          <Stop offset="1" stopColor="#0B1220" stopOpacity={0.72} />
        </LinearGradient>
      </Defs>
      <Rect width={SCREEN_WIDTH} height={SCRIM_HEIGHT} fill="url(#scrim)" />
    </Svg>
  );
}

export default function OnboardingScreen({ onGetStarted, onSkip }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Same quick fade-in technique as Splash/Auth, so the Splash -> Onboarding handoff feels like
  // one continuous arrival rather than an instant pop the moment Splash's timer/tap fires.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fade]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const goToSlide = (index: number) => {
    // activeIndex is intentionally NOT set here — it tracks the ScrollView's real animated
    // position via onScroll/onMomentumScrollEnd instead, the same as a swipe-driven page change.
    // Setting it immediately made the title/description/CTA/dot jump to the next slide's content
    // while the previous photo was still visibly sliding away underneath it. Relying only on
    // onMomentumScrollEnd isn't enough on its own, though — react-native-web doesn't reliably
    // fire that native-only momentum event for a programmatic animated scrollTo, which left the
    // index stuck and made "Next"/dot taps look like they did nothing on web. onScroll (with a
    // throttle) tracks the actual scroll position as it animates on every platform.
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={styles.slide}>
            {/* The photo is the entire screen's background — full-bleed, not an illustration
                sitting above a block of UI. */}
            <Image source={slide.image} style={styles.heroImage} resizeMode="cover" />
            <BottomScrim />
          </View>
        ))}
      </ScrollView>

      {/* All text, controls, and the CTA are native UI layered over the photo — nothing is
          baked into the images. */}
      <View style={[styles.topRow, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
        {!isLastSlide && (
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.75}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.bottomContent, { paddingBottom: insets.bottom + SPACING.lg }]} pointerEvents="box-none">
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, index) => (
            <TouchableOpacity key={slide.key} onPress={() => goToSlide(index)} hitSlop={8}>
              <View style={[styles.dot, index === activeIndex && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.title}>{SLIDES[activeIndex].title}</Text>
        <Text style={styles.description}>{SLIDES[activeIndex].description}</Text>

        <Button
          label={isLastSlide ? 'Get Started' : 'Next'}
          onPress={isLastSlide ? onGetStarted : () => goToSlide(activeIndex + 1)}
          style={styles.ctaBtn}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  topRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
  },
  skipBtn: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  ctaBtn: {
    marginBottom: 0,
  },
});
