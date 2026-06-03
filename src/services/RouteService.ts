// Service OSRM — calcul d'itinéraire + recalcul automatique
import { OSRM_BASE_URL } from '../utils/constants';
import type { RouteResult, RouteStep } from '../types';

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { steps: OsrmStep[] }[];
}

interface OsrmStep {
  maneuver: { instruction?: string; type: string };
  distance: number;
  name: string;
}

export async function getRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<RouteResult> {
  const url = `${OSRM_BASE_URL}/${fromLng},${fromLat};${toLng},${toLat}` +
              `?overview=full&geometries=geojson&steps=true&annotations=false`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error('OSRM indisponible');

  const json = await resp.json();
  if (!json.routes?.length) throw new Error('Aucun itinéraire trouvé');

  const route: OsrmRoute = json.routes[0];
  const steps: RouteStep[] = (route.legs[0]?.steps ?? []).map((s: OsrmStep) => ({
    instruction: formatInstruction(s),
    distanceM: s.distance,
    maneuver: s.maneuver.type,
  }));

  return {
    coordinates: route.geometry.coordinates,
    distanceM: route.distance,
    durationS: route.duration,
    steps,
  };
}

function formatInstruction(step: OsrmStep): string {
  const type = step.maneuver.type;
  const name = step.name || '';
  const mapping: Record<string, string> = {
    'turn':              'Tournez',
    'depart':            'Démarrez',
    'arrive':            'Vous êtes arrivé',
    'merge':             'Rejoignez',
    'ramp':              'Prenez la bretelle',
    'on ramp':           'Prenez la bretelle',
    'off ramp':          'Quittez par la bretelle',
    'fork':              'Au carrefour, prenez',
    'end of road':       'Au bout de la route',
    'use lane':          'Utilisez la voie',
    'continue':          'Continuez',
    'roundabout':        'Au rond-point',
    'rotary':            'Au rond-point',
    'roundabout turn':   'Au rond-point, tournez',
    'notification':      '',
    'new name':          'Continuez sur',
  };
  const verb = mapping[type] ?? 'Continuez';
  return name ? `${verb} sur ${name}` : verb;
}

export function distanceBetween(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
