// Carte interactive — nids-de-poule OpenStreetMap via Leaflet (WebView)
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../api/axios.config';
import type { ApiResponse } from '../../types';

interface HazardPoint {
  id: string;
  latitude: number;
  longitude: number;
  severity: string;
  hazardType: string;
  shockMagnitude: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#4CAF50',
  MEDIUM: '#FF9800',
  HIGH: '#F44336',
  CRITICAL: '#7B0000',
};

function buildLeafletHtml(hazards: HazardPoint[], userLat: number, userLng: number): string {
  const markers = hazards.map(h => {
    const color = SEVERITY_COLOR[h.severity] ?? '#9E9E9E';
    return `
      L.circleMarker([${h.latitude}, ${h.longitude}], {
        radius: ${h.severity === 'CRITICAL' ? 12 : h.severity === 'HIGH' ? 9 : 7},
        fillColor: '${color}',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.9
      }).addTo(map).bindPopup(
        '<b>${h.severity}</b><br>${h.hazardType}<br>Magnitude: ${h.shockMagnitude.toFixed(2)}'
      );`;
  }).join('\n');

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{width:100%;height:100%;margin:0;padding:0;}</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${userLat}, ${userLng}], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);
  ${userLat !== 0 ? `
  L.circleMarker([${userLat}, ${userLng}], {
    radius: 10, fillColor: '#1B5E20', color: '#fff', weight: 2, fillOpacity: 1
  }).addTo(map).bindPopup('<b>Votre position</b>').openPopup();` : ''}
  ${markers}
</script>
</body></html>`;
}

export default function MapScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [hazards, setHazards] = useState<HazardPoint[]>([]);
  const [userLat, setUserLat] = useState(3.848); // Yaoundé par défaut
  const [userLng, setUserLng] = useState(11.502);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0 });

  useEffect(() => {
    async function load() {
      // Position GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
      }
      // Hazards depuis le backend
      try {
        const { data } = await api.get<ApiResponse<HazardPoint[]>>('/api/hazards/map');
        const pts = data.data ?? [];
        setHazards(pts);
        setCounts({
          total: pts.length,
          critical: pts.filter(h => h.severity === 'CRITICAL').length,
          high: pts.filter(h => h.severity === 'HIGH').length,
        });
      } catch { /* mode offline */ }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loading) {
      setHtmlContent(buildLeafletHtml(hazards, userLat, userLng));
    }
  }, [loading, hazards, userLat, userLng]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>Carte des routes</Text>
          <Text style={styles.headerSub}>Nids-de-poule signalés en temps réel</Text>
        </View>
      </LinearGradient>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="map-marker-alert" size={16} color="#616161" />
          <Text style={styles.statText}>{counts.total} signalés</Text>
        </View>
        <View style={[styles.statItem, styles.statDot, { backgroundColor: '#F44336' }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statText, { color: '#F44336' }]}>{counts.high} HIGH</Text>
        </View>
        <View style={[styles.statItem, styles.statDot, { backgroundColor: '#7B0000' }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statText, { color: '#7B0000' }]}>{counts.critical} CRITICAL</Text>
        </View>

        {/* Légende */}
        {(['LOW','MEDIUM','HIGH','CRITICAL'] as const).map(s => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLOR[s] }]} />
            <Text style={styles.legendLabel}>{s}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement de la carte…</Text>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ html: htmlContent }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1B5E20" />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  headerBody: { gap: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10,
    elevation: 2,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 12, fontWeight: '600', color: '#616161' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 10, color: '#757575', fontWeight: '600' },

  map: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9E9E9E' },
});
