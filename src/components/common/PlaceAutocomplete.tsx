import React, { useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Platform, Keyboard,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    county?: string;
  };
  type?: string;
}

interface PlaceAutocompleteProps {
  label: string;
  value: string;
  onSelect: (place: { label: string; lat: number; lng: number }) => void;
  onChangeText?: (text: string) => void;
  error?: string;
  dotColor?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 400;

export function PlaceAutocomplete({
  label, value, onSelect, onChangeText, error, dotColor,
}: PlaceAutocompleteProps) {
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setShowDropdown(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q, countrycodes: 'cm', format: 'json',
        addressdetails: '1', limit: '6', 'accept-language': 'fr',
      });
      const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': 'KmerFret/2.0' },
        signal: AbortSignal.timeout(8000),
      });
      const data: NominatimResult[] = await resp.json();
      setResults(data);
      setShowDropdown(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    onChangeText?.(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(text), DEBOUNCE_MS);
  };

  const handleSelect = (item: NominatimResult) => {
    const addr = item.address;
    const city = addr?.city || addr?.town || addr?.village || '';
    const suburb = addr?.suburb || '';
    const road = addr?.road || '';
    const parts = [road, suburb, city].filter(Boolean);
    const displayLabel = parts.length > 0 ? parts.join(', ') : item.display_name.split(',').slice(0, 3).join(',');

    setQuery(displayLabel);
    setShowDropdown(false);
    setResults([]);
    Keyboard.dismiss();
    onSelect({
      label: displayLabel,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });
  };

  const formatSubtitle = (item: NominatimResult): string => {
    const addr = item.address;
    if (!addr) return '';
    const state = addr.state || addr.county || '';
    const city = addr.city || addr.town || addr.village || '';
    return [city, state].filter(Boolean).join(', ');
  };

  const formatTitle = (item: NominatimResult): string => {
    const parts = item.display_name.split(',');
    return parts[0]?.trim() || '';
  };

  return (
    <View style={s.container}>
      <TextInput
        label={label}
        value={query}
        onChangeText={handleChange}
        mode="outlined"
        outlineStyle={[s.outline, error ? { borderColor: '#B71C1C' } : {}]}
        left={<TextInput.Icon icon="map-marker" color={dotColor} />}
        right={loading ? <TextInput.Icon icon={() => <ActivityIndicator size={16} />} /> : undefined}
        onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        style={s.input}
      />
      {!!error && <Text style={s.error}>{error}</Text>}

      {showDropdown && (
        <View style={[s.dropdown, { backgroundColor: C.surface, borderColor: C.outline }]}>
          <FlatList
            data={results}
            keyExtractor={item => String(item.place_id)}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={s.list}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [s.item, pressed && { backgroundColor: C.primaryContainer }]}
                onPress={() => handleSelect(item)}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={18} color={C.primary} style={s.itemIcon} />
                <View style={s.itemText}>
                  <Text style={[s.itemTitle, { color: C.textPrimary }]} numberOfLines={1}>
                    {formatTitle(item)}
                  </Text>
                  <Text style={[s.itemSub, { color: C.textMuted }]} numberOfLines={1}>
                    {formatSubtitle(item)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { position: 'relative', zIndex: 10 },
  input: { marginBottom: 2 },
  outline: { borderRadius: 10 },
  error: { fontSize: 11, color: '#B71C1C', marginLeft: 4, marginBottom: 4 },
  dropdown: {
    borderRadius: 12, borderWidth: 1, marginTop: 2,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8,
    maxHeight: 220, overflow: 'hidden',
  },
  list: { maxHeight: 220 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0',
  },
  itemIcon: { marginRight: 10 },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemSub: { fontSize: 11, marginTop: 1 },
});
