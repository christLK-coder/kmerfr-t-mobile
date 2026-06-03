import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '../../theme/theme';
import { useThemeStore } from '../../store/themeStore';
import { formatDistance, formatDuration } from '../../services/RouteService';

interface DriverPosition {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
}

interface ImporterTrackingMapProps {
  originLat: number;
  originLng: number;
  originLabel: string;
  destLat: number;
  destLng: number;
  destLabel: string;
  driverPosition?: DriverPosition | null;
  routeCoords?: [number, number][];   // [lng, lat] from OSRM
  distanceM?: number;
  durationS?: number;
}

export function ImporterTrackingMap({
  originLat, originLng, originLabel,
  destLat, destLng, destLabel,
  driverPosition, routeCoords,
  distanceM, durationS,
}: ImporterTrackingMapProps) {
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const webRef = useRef<WebView>(null);

  // Envoyer uniquement la nouvelle position via injectJavaScript — pas de rechargement
  const updateDriverMarker = useCallback((pos: DriverPosition) => {
    webRef.current?.injectJavaScript(
      `updateDriver(${pos.lat}, ${pos.lng}, ${pos.heading ?? 0}); true;`
    );
  }, []);

  useEffect(() => {
    if (driverPosition) updateDriverMarker(driverPosition);
  }, [driverPosition]);

  // routeCoords est [lng, lat] (OSRM) → on convertit en [lat, lng] pour Leaflet
  const routeJson = useMemo(
    () => routeCoords ? JSON.stringify(routeCoords.map(([lng, lat]) => [lat, lng])) : '[]',
    [routeCoords]
  );

  // L'HTML est mémoïsé : ne se régénère que si la route ou le thème change
  // (pas à chaque mise à jour de la position du chauffeur — géré via injectJavaScript)
  const html = useMemo(() => `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${isDark ? '#121212' : '#f5f5f5'}}
  .driver-icon{background:transparent;border:none}
  .info-bar{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);
    background:${isDark ? '#1a1a1a' : '#fff'};border-radius:12px;padding:10px 20px;
    display:flex;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.2);z-index:1000;align-items:center}
  .info-item{text-align:center}
  .info-val{font-weight:700;font-size:16px;color:${C.primary}}
  .info-lbl{font-size:10px;color:${isDark ? '#aaa' : '#757575'};margin-top:2px}
  .info-sep{width:1px;height:30px;background:${isDark ? '#333' : '#e0e0e0'}}
</style>
</head>
<body>
<div id="map"></div>
<div class="info-bar" id="infoBar" style="display:${distanceM ? 'flex' : 'none'}">
  <div class="info-item">
    <div class="info-val" id="distVal">${distanceM ? formatDistance(distanceM) : '-'}</div>
    <div class="info-lbl">Restant</div>
  </div>
  <div class="info-sep"></div>
  <div class="info-item">
    <div class="info-val" id="etaVal">${durationS ? formatDuration(durationS) : '-'}</div>
    <div class="info-lbl">Arrivée</div>
  </div>
</div>
<script>
const map = L.map('map',{zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Marqueur départ (vert pulsant)
const originIcon = L.divIcon({html:'<div style="position:relative"><div style="width:18px;height:18px;border-radius:50%;background:#1B5E20;border:3px solid #fff;box-shadow:0 2px 8px rgba(27,94,32,0.5)"></div><div style="position:absolute;top:-6px;left:-6px;width:30px;height:30px;border-radius:50%;background:rgba(27,94,32,0.2);animation:pulse 2s infinite"></div></div>',iconSize:[18,18],iconAnchor:[9,9],className:'driver-icon'});
const originMarker = L.marker([${originLat},${originLng}],{icon:originIcon}).addTo(map);
originMarker.bindPopup('<b>Depart</b><br>${originLabel}');

// Marqueur arrivée (drapeau rouge)
const destIcon = L.divIcon({html:'<div style="position:relative"><div style="width:18px;height:18px;border-radius:50%;background:#C62828;border:3px solid #fff;box-shadow:0 2px 8px rgba(198,40,40,0.5)"></div><div style="width:3px;height:22px;background:#C62828;position:absolute;top:-22px;left:7px;border-radius:2px"></div><div style="width:14px;height:10px;background:#C62828;position:absolute;top:-22px;left:10px;border-radius:0 3px 3px 0"></div></div>',iconSize:[18,18],iconAnchor:[9,9],className:'driver-icon'});
const destMarker = L.marker([${destLat},${destLng}],{icon:destIcon}).addTo(map);
destMarker.bindPopup('<b>Arrivee</b><br>${destLabel}');

// Route de base (trajet complet — transparente en arrière-plan)
const routeCoords = ${routeJson};
if(routeCoords.length>1){
  L.polyline(routeCoords,{color:'${isDark ? '#444' : '#BDBDBD'}',weight:6,opacity:0.5,lineCap:'round',lineJoin:'round',dashArray:'8,12'}).addTo(map);
}

// Route active du chauffeur (trait foncé épais)
let driverRoute = null;
function updateRoute(drvLat,drvLng){
  if(!routeCoords.length) return;
  let minD=Infinity,idx=0;
  for(let i=0;i<routeCoords.length;i++){
    const d=Math.pow(routeCoords[i][0]-drvLat,2)+Math.pow(routeCoords[i][1]-drvLng,2);
    if(d<minD){minD=d;idx=i;}
  }
  const remaining=routeCoords.slice(idx);
  if(driverRoute) map.removeLayer(driverRoute);
  driverRoute=L.polyline(remaining,{color:'#1B5E20',weight:5,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(map);
}

// Marqueur chauffeur (camion réaliste)
const truckSvg='<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#1B5E20" stroke="#fff" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="20">🚛</text></svg>';
const truckIcon = L.divIcon({html:truckSvg,className:'driver-icon',iconSize:[40,40],iconAnchor:[20,20]});
let driverMarker = null;

function updateDriver(lat,lng,heading){
  if(!driverMarker){
    driverMarker = L.marker([lat,lng],{icon:truckIcon,zIndexOffset:1000}).addTo(map);
  } else {
    driverMarker.setLatLng([lat,lng]);
  }
  updateRoute(lat,lng);
  map.panTo([lat,lng],{animate:true,duration:0.8});
}

// Animation pulsation CSS
const style=document.createElement('style');
style.textContent='@keyframes pulse{0%{transform:scale(1);opacity:0.7}50%{transform:scale(1.5);opacity:0}100%{transform:scale(1);opacity:0}}';
document.head.appendChild(style);

// Fit bounds
const allPoints = [[${originLat},${originLng}],[${destLat},${destLng}]];
if(routeCoords.length>1) allPoints.push(...routeCoords);
map.fitBounds(allPoints,{padding:[50,50],animate:true});
</script>
</body></html>`, [routeJson, isDark, C.primary, originLat, originLng, originLabel,
    destLat, destLng, destLabel, distanceM, durationS]);

  return (
    <View style={s.container}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={s.map}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', borderRadius: 12 },
  map: { flex: 1 },
});
