import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../api/axios.config';
import { useMissionStore } from '../../store/missionStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { ApiResponse, MissionResponse } from '../../types';
import type { MainStackParamList } from '../../navigation/MainNavigator';

interface WeatherInfo {
  temp: number;
  description: string;
  icon: string;
  city: string;
  rain: boolean;
}

interface HazardPoint {
  id: string;
  latitude: number;
  longitude: number;
  severity: string;
  hazardType: string;
  shockMagnitude: number;
}

type Nav = NativeStackNavigationProp<MainStackParamList>;

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#0277BD', ASSIGNED: '#F57F17', IN_TRANSIT: '#E65100', DELIVERED: '#2E7D32',
};

function buildLeafletHtml(
  missions: MissionResponse[],
  userLat: number, userLng: number,
  isDark: boolean, primaryColor: string,
): string {
  const missionMarkers = missions
    .filter(m => m.originLat && m.destinationLat)
    .map(m => {
      const color = STATUS_COLORS[m.status] ?? '#757575';
      return `
      L.circleMarker([${m.originLat},${m.originLng}],{radius:8,fillColor:'${color}',color:'#fff',weight:2,fillOpacity:0.9})
        .addTo(map).bindPopup('<b>${m.originLabel}</b><br>→ ${m.destinationLabel}<br><span style="color:${color};font-weight:700">${m.status}</span><br>${(m.totalPrice??0).toLocaleString()} FCFA');
      L.polyline([[${m.originLat},${m.originLng}],[${m.destinationLat},${m.destinationLng}]],
        {color:'${color}',weight:2,opacity:0.4,dashArray:'6,8'}).addTo(map);`;
    }).join('\n');

  const bg = isDark ? '#121212' : '#f5f5f5';
  const tiles = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{width:100%;height:100%;margin:0;padding:0;background:${bg}}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${userLat},${userLng}],7);
L.tileLayer('${tiles}',{maxZoom:19}).addTo(map);
L.circleMarker([${userLat},${userLng}],{radius:8,fillColor:'${primaryColor}',color:'#fff',weight:3,fillOpacity:1}).addTo(map).bindPopup('<b>Ma position</b>').openPopup();
${missionMarkers}
</script></body></html>`;
}

export default function MapScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const webRef = useRef<WebView>(null);
  const { activeMissions, fetchActiveMissions } = useMissionStore();

  const [userLat, setUserLat] = useState(4.05);
  const [userLng, setUserLng] = useState(9.77);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [showList, setShowList] = useState(false);

  useFocusEffect(useCallback(() => { fetchActiveMissions(); }, []));

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      setHtmlContent(buildLeafletHtml(activeMissions, userLat, userLng, isDark, C.primary));
    }
  }, [loading, activeMissions, userLat, userLng, isDark]);

  const inTransit = activeMissions.filter(m => m.status === 'IN_TRANSIT');
  const pending = activeMissions.filter(m => m.status === 'OPEN' || m.status === 'ASSIGNED');

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Carte plein écran */}
      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView ref={webRef} source={{ html: htmlContent }} style={st.map}
            javaScriptEnabled domStorageEnabled scrollEnabled={false}
            mixedContentMode="always" originWhitelist={['*']} />

          {/* Overlay boutons */}
          <View style={[st.topBar, { top: insets.top + 8 }]}>
            <TouchableOpacity style={[st.fabSmall, { backgroundColor: C.surface }]}
              onPress={() => webRef.current?.injectJavaScript(`map.setView([${userLat},${userLng}],13);true;`)}>
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* Badge missions */}
          <Pressable style={[st.missionBadge, { backgroundColor: C.surface, bottom: showList ? 220 : 16 }]}
            onPress={() => setShowList(!showList)}>
            <View style={[st.badgeDot, { backgroundColor: inTransit.length > 0 ? '#E65100' : C.primary }]} />
            <Text style={[st.badgeText, { color: C.textPrimary }]}>
              {inTransit.length} en transit · {pending.length} en attente
            </Text>
            <MaterialCommunityIcons name={showList ? 'chevron-down' : 'chevron-up'} size={20} color={C.textMuted} />
          </Pressable>

          {/* Liste missions en overlay */}
          {showList && (
            <View style={[st.listOverlay, { backgroundColor: C.surface }]}>
              <FlatList
                data={activeMissions}
                keyExtractor={i => i.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
                renderItem={({ item }) => {
                  const color = STATUS_COLORS[item.status] ?? C.textMuted;
                  return (
                    <Pressable style={[st.miniCard, { backgroundColor: C.background, borderLeftColor: color }]}
                      onPress={() => nav.navigate('MissionDetail', { missionId: item.id })}>
                      <Chip compact style={{ backgroundColor: color + '22', alignSelf: 'flex-start' }}
                        textStyle={{ color, fontSize: 9, fontWeight: '700' }}>{item.status}</Chip>
                      <Text style={[st.miniRoute, { color: C.textPrimary }]} numberOfLines={1}>
                        {item.originLabel} → {item.destinationLabel}
                      </Text>
                      <Text style={[st.miniPrice, { color: C.primary }]}>
                        {(item.totalPrice ?? 0).toLocaleString('fr-FR')} FCFA
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', right: 12, flexDirection: 'row', gap: 8 },
  fabSmall: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  missionBadge: { position: 'absolute', left: 12, right: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  badgeText: { flex: 1, fontSize: 13, fontWeight: '600' },
  listOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 14, elevation: 8 },
  miniCard: { width: 200, borderRadius: 12, padding: 12, gap: 6, borderLeftWidth: 4 },
  miniRoute: { fontSize: 12, fontWeight: '600' },
  miniPrice: { fontSize: 13, fontWeight: '700' },
});
