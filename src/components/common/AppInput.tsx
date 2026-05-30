// Champ de saisie réutilisable avec validation inline et icône
import React, { useState } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';

interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  icon?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export function AppInput({
  label,
  value,
  onChangeText,
  error,
  icon,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  placeholder,
  disabled = false,
  style,
  multiline = false,
  numberOfLines = 1,
}: AppInputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const showToggle = secureTextEntry;
  const isSecure = secureTextEntry && !passwordVisible;

  return (
    <>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        error={!!error}
        left={icon ? <TextInput.Icon icon={icon} /> : undefined}
        right={
          showToggle
            ? <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible(v => !v)}
              />
            : undefined
        }
        secureTextEntry={isSecure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
        disabled={disabled}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[styles.input, style]}
      />
      {!!error && (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 4 },
});
