import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { ShieldAlert, PhoneCall } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { DriverProfile } from '../types';
import { useToast } from './Toast';

interface SOSModalProps {
  visible: boolean;
  onClose: () => void;
  driver: DriverProfile;
}

/**
 * Municipal emergency SOS sheet, extracted out of ActiveRideScreen so the
 * ride screen only owns the ride UI and this owns the (appropriately
 * high-contrast, urgent) emergency flow.
 */
export default function SOSModal({ visible, onClose, driver }: SOSModalProps) {
  const { showToast } = useToast();

  const handleDialPolice = () => {
    showToast('Dialing PNP Nasugbu Police Desk (117)...', 'info');
  };

  const handleDialTmo = () => {
    showToast('Dialing Nasugbu Traffic Management Office...', 'info');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <ShieldAlert size={28} color={COLORS.danger} />
            </View>
            <Text style={styles.title}>MUNICIPAL EMERGENCY SOS</Text>
            <Text style={styles.subtitle}>
              Real-time distress beacon will broadcast your GPS coordinates and unit details (
              {driver.tricycle.plateNumber}) to Municipal Traffic Office & PNP Command.
            </Text>
          </View>

          <View style={styles.detailsBox}>
            <Text style={styles.detailItem}>• Driver: {driver.name}</Text>
            <Text style={styles.detailItem}>
              • Tricycle: {driver.tricycle.plateNumber} (Unit {driver.tricycle.codingNumber})
            </Text>
            <Text style={styles.detailItem}>• Zone: {driver.todaName || 'TODA Bucana'}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.callBtn} onPress={handleDialPolice} activeOpacity={0.88}>
              <PhoneCall size={18} color="#FFFFFF" />
              <Text style={styles.callBtnText}>Call PNP Police (117)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tmoBtn} onPress={handleDialTmo} activeOpacity={0.88}>
              <PhoneCall size={18} color={COLORS.primary} />
              <Text style={styles.tmoBtnText}>Call Traffic Office (TMO)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.dismissText}>Dismiss (False Alarm)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    ...SHADOWS.sheet,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.dangerSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.dangerBorder,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.danger,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  detailsBox: {
    backgroundColor: COLORS.backgroundSubtle,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  detailItem: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  actions: {
    gap: 10,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  tmoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.backgroundSubtle,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
  },
  tmoBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
