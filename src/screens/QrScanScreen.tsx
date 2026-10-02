import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { X, ScanLine, CameraOff } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useQrRide } from '../context/QrRideContext';
import Button from '../components/Button';

interface QrScanScreenProps {
  topInset?: number;
}

/** How long a "not a Trivora QR" notice stays up before the camera accepts codes again. */
const REJECT_COOLDOWN_MS = 2500;

/**
 * Scan to Ride camera. Only a Trivora ride QR (https://<app>/ride/q/{token}) is accepted; the
 * token is handed straight to QrRideContext, which resolves it server-side. The token itself is
 * never shown.
 */
export default function QrScanScreen({ topInset = 0 }: QrScanScreenProps) {
  const { submitScannedData, closeQr } = useQrRide();
  const [permission, requestPermission] = useCameraPermissions();
  const [notice, setNotice] = useState<string | null>(null);
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Ask once on open; a denial is handled by the explanation below.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission?.granted, permission?.canAskAgain]);

  const handleScanned = useCallback((result: BarcodeScanningResult) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    if (submitScannedData(result.data)) return; // context moves on to the tricycle screen
    setNotice("This isn't a Trivora tricycle QR code.");
    timerRef.current = setTimeout(() => {
      lockedRef.current = false;
      setNotice(null);
    }, REJECT_COOLDOWN_MS);
  }, [submitScannedData]);

  const header = (
    <View style={[styles.header, { paddingTop: topInset + SPACING.sm }]}>
      <TouchableOpacity onPress={closeQr} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close scanner">
        <X size={22} color={COLORS.textInverse} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Scan to Ride</Text>
      <View style={styles.closeBtn} />
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.dark}>
        {header}
        <View style={styles.center}><ActivityIndicator color={COLORS.textInverse} /></View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.dark}>
        {header}
        <View style={styles.center}>
          <CameraOff size={36} color={COLORS.darkTextSecondary} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            Allow camera access to scan the QR code on the tricycle you're boarding.
          </Text>
          <View style={styles.permActions}>
            {permission.canAskAgain ? (
              // Light button: the navy primary one disappears on the scanner's dark backdrop.
              <Button label="Allow Camera" variant="secondary" onPress={requestPermission} />
            ) : (
              <Button label="Open Settings" variant="secondary" onPress={() => Linking.openSettings().catch(() => {})} />
            )}
            <TouchableOpacity onPress={closeQr} style={styles.cancelBtn} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dark}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />
      {header}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.instruction}>
          <ScanLine size={16} color={COLORS.textInverse} />
          <Text style={styles.instructionText}>Point your camera at the QR code on the tricycle</Text>
        </View>
        {notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const FRAME = 240;
const CORNER = 28;

const styles = StyleSheet.create({
  dark: {
    flex: 1,
    backgroundColor: COLORS.darkBackground,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    // Readable over any camera scene, including a bright one.
    backgroundColor: 'rgba(20, 26, 49, 0.72)',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textInverse,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  frame: {
    width: FRAME,
    height: FRAME,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: COLORS.textInverse,
    // A thin dark edge so the white frame stays visible over bright scenes.
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: RADIUS.md },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: RADIUS.md },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: RADIUS.md },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: RADIUS.md },
  instruction: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(20, 26, 49, 0.72)',
  },
  instructionText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textInverse,
  },
  notice: {
    marginTop: SPACING.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dangerLight,
  },
  noticeText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    color: COLORS.dangerDarker,
  },
  permTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textInverse,
    marginTop: SPACING.md,
  },
  permBody: {
    ...TYPOGRAPHY.body,
    color: COLORS.darkTextSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    maxWidth: 300,
  },
  permActions: {
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  cancelBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textInverse,
  },
});
