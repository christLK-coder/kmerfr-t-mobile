import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import type { RouteStep } from '../../types';

export interface DriverMapHandle {
  updatePosition: (lat: number, lng: number, heading: number) => void;
  updateRoute: (coords: [number, number][]) => void;
  showInstruction: (text: string) => void;
}

interface DriverNavigationMapProps {
  destLat: number;
  destLng: number;
  destLabel: string;
  originLat?: number;
  originLng?: number;
  routeCoords?: [number, number][];
  hazards?: { lat: number; lng: number; severity: string }[];
  onMapReady?: () => void;
}

const DriverNavigationMap = forwardRef<DriverMapHandle, DriverNavigationMapProps>(({
  destLat, destLng, destLabel,
  originLat, originLng,
  routeCoords, hazards, onMapReady,
}, ref) => {
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const webRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    updatePosition: (lat, lng, heading) => {
      webRef.current?.injectJavaScript(`updateDriver(${lat},${lng},${heading});true;`);
    },
    updateRoute: (coords) => {
      const latLngs = coords.map(([lng, lat]) => [lat, lng]);
      webRef.current?.injectJavaScript(`updateRoute(${JSON.stringify(latLngs)});true;`);
    },
    showInstruction: (text) => {
      webRef.current?.injectJavaScript(`showInstruction(${JSON.stringify(text)});true;`);
    },
  }));

  const hazardJson = hazards ? JSON.stringify(hazards) : '[]';
  const routeJson = routeCoords ? JSON.stringify(routeCoords.map(([lng, lat]) => [lat, lng])) : '[]';

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${isDark ? '#121212' : '#e8f5e9'}}
  .instr-bar{position:absolute;top:12px;left:12px;right:12px;z-index:1000;
    background:${isDark ? '#1E1E1E' : '#fff'};border-radius:12px;padding:14px 16px;
    box-shadow:0 4px 16px rgba(0,0,0,0.25);display:flex;align-items:center;gap:12px}
  .instr-icon{font-size:24px;flex-shrink:0}
  .instr-text{font-size:15px;font-weight:600;color:${isDark ? '#E8E8E8' : '#212121'};flex:1;line-height:1.4}
  .hazard-dot{width:12px;height:12px;border-radius:50%;border:2px solid white;display:block}
</style>
</head>
<body>
<div id="map"></div>
<div class="instr-bar" id="instrBar">
  <span class="instr-icon">🧭</span>
  <span class="instr-text" id="instrText">Navigation en cours…</span>
</div>
<script>
const isDark = ${isDark};
const map = L.map('map',{zoomControl:false,attributionControl:false});
const tileUrl = isDark
  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
L.tileLayer(tileUrl).addTo(map);

// Destination
const destIcon = L.divIcon({html:'<div style="width:18px;height:18px;border-radius:50%;background:#C62828;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',iconSize:[18,18],iconAnchor:[9,9]});
L.marker([${destLat},${destLng}],{icon:destIcon}).addTo(map).bindPopup('${destLabel}');

// Dangers routiers
const hazards = ${hazardJson};
const hazardColors = {LOW:'#F57F17',MEDIUM:'#E65100',HIGH:'#C62828',CRITICAL:'#B71C1C'};
hazards.forEach(h=>{
  const ic = L.divIcon({html:'<div class="hazard-dot" style="background:'+hazardColors[h.severity]+'"></div>',iconSize:[12,12],iconAnchor:[6,6]});
  L.marker([h.lat,h.lng],{icon:ic}).addTo(map).bindPopup('Danger: '+h.severity);
});

// Route
let routeLine;
const initCoords = ${routeJson};
if(initCoords.length>1){
  routeLine = L.polyline(initCoords,{color:'#1B5E20',weight:6,opacity:0.9}).addTo(map);
  map.fitBounds(routeLine.getBounds(),{padding:[60,60]});
}

// Chauffeur
const truckIcon = L.divIcon({
  html:'<div style="font-size:28px;transform-origin:center;transform:rotate(0deg)">🚛</div>',
  className:'',iconSize:[34,34],iconAnchor:[17,17]
});
let driver = null;
let driverHeading = 0;

function updateDriver(lat,lng,heading){
  driverHeading = heading;
  if(!driver){
    driver = L.marker([lat,lng],{icon:truckIcon,zIndexOffset:1000}).addTo(map);
  } else {
    driver.setLatLng([lat,lng]);
  }
  // Mettre à jour la rotation du camion
  const el = driver.getElement();
  if(el) el.querySelector('div').style.transform = 'rotate('+heading+'deg)';
  // Recentrer si le camion sort du viewport
  if(!map.getBounds().contains([lat,lng])){
    map.panTo([lat,lng],{animate:true,duration:0.8});
  }
}

function updateRoute(coords){
  if(routeLine){map.removeLayer(routeLine);}
  if(coords.length>1){
    routeLine = L.polyline(coords,{color:'#1B5E20',weight:6,opacity:0.9}).addTo(map);
  }
}

function showInstruction(text){
  document.getElementById('instrText').textContent = text;
}

// Centrer sur la destination au départ
${originLat ? `map.setView([${originLat},${originLng}],14);` : `map.setView([${destLat},${destLng}],13);`}
window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ready');
</script>
</body></html>`;

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
        onMessage={(e) => { if (e.nativeEvent.data === 'ready') onMapReady?.(); }}
      />
    </View>
  );
});

export default DriverNavigationMap;

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
