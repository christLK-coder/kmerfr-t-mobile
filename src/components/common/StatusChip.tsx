// Chip coloré selon le statut d'une mission
import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

export type MissionStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'DISPUTED';

interface StatusChipProps {
  status: MissionStatus;
}

const STATUS_CONFIG: Record<MissionStatus, { label: string; bg: string; text: string }> = {
  OPEN:       { label: 'Disponible',  bg: '#E3F2FD', text: '#1565C0' },
  ASSIGNED:   { label: 'Assignée',    bg: '#FFF8E1', text: '#F57F17' },
  IN_TRANSIT: { label: 'En route',    bg: '#FFF3E0', text: '#E65100' },
  DELIVERED:  { label: 'Livrée',      bg: '#E8F5E9', text: '#2E7D32' },
  CANCELLED:  { label: 'Annulée',     bg: '#FFEBEE', text: '#B71C1C' },
  DISPUTED:   { label: 'Contestée',   bg: '#F3E5F5', text: '#6A1B9A' },
};

export function StatusChip({ status }: StatusChipProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;

  return (
    <Chip
      style={[styles.chip, { backgroundColor: config.bg }]}
      textStyle={[styles.text, { color: config.text }]}
      compact
    >
      {config.label}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: 8 },
  text: { fontSize: 12, fontWeight: '600' },
});
