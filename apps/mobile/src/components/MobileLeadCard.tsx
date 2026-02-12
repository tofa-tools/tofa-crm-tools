import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { StandardText } from './StandardText';
import { brandColors } from '../theme/brandTheme';
import type { Lead } from '@tofa/core';
import { generateWhatsAppLink, calculateAge } from '@tofa/core';

interface MobileLeadCardProps {
  lead: Lead;
}

const WHATSAPP_ICON = '💬'; // or use react-native-vector-icons / icon font

export function MobileLeadCard({ lead }: MobileLeadCardProps) {
  const hasPhone = !!lead.phone && lead.phone.length >= 10;

  const openWhatsApp = () => {
    if (!hasPhone) return;
    const url = generateWhatsAppLink(lead.phone!, 'Hi');
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <StandardText variant="body" style={styles.name}>
          {lead.player_name}
        </StandardText>
        <StandardText variant="muted" style={styles.age}>
          {lead.date_of_birth ? (calculateAge(lead.date_of_birth) ?? '') : ''}
        </StandardText>
      </View>
      <TouchableOpacity
        style={[styles.whatsappBtn, !hasPhone && styles.whatsappDisabled]}
        onPress={openWhatsApp}
        disabled={!hasPhone}
      >
        <StandardText variant="accent" style={styles.whatsappIcon}>
          {WHATSAPP_ICON}
        </StandardText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: brandColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: brandColors.accent,
  },
  info: { flex: 1 },
  name: { fontWeight: '600', color: brandColors.primary },
  age: { fontSize: 14, marginTop: 2 },
  whatsappBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  whatsappDisabled: { opacity: 0.4 },
  whatsappIcon: { fontSize: 22 },
});
