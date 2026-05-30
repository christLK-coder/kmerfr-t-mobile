// Bouton réutilisable avec variantes primary / danger / outlined
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';
import { KmerFretColors } from '../../theme/theme';

type Variant = 'primary' | 'danger' | 'outlined';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const variantConfig: Record<Variant, { mode: 'contained' | 'outlined'; buttonColor?: string }> = {
  primary:  { mode: 'contained', buttonColor: KmerFretColors.primary },
  danger:   { mode: 'contained', buttonColor: KmerFretColors.error },
  outlined: { mode: 'outlined' },
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: AppButtonProps) {
  const { mode, buttonColor } = variantConfig[variant];

  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      buttonColor={buttonColor}
      style={[fullWidth && styles.fullWidth, style]}
      contentStyle={styles.content}
      labelStyle={styles.label}
    >
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  content:   { paddingVertical: 4 },
  label:     { fontSize: 16, letterSpacing: 0.5 },
});
