// Overlay plein écran semi-transparent avec indicateur de chargement
import React from 'react';
import { StyleSheet, View, Modal } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { KmerFretColors } from '../../theme/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ActivityIndicator
            size="large"
            color={KmerFretColors.primary}
            animating={visible}
          />
          {!!message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    minWidth: 140,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
