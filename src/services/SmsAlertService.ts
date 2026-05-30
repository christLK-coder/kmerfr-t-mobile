import * as SMS from 'expo-sms';
import * as Location from 'expo-location';
import { db } from '../database/schema';
import { buildAlertMessage } from '../utils/cryptoUtils';
import type { LocalAlert } from '../types';

const PLATFORM_PHONE = '+237600000000';

export interface AlertPayload {
  userId: string;
  missionId?: string;
  alertType: LocalAlert['alert_type'];
  message?: string;
}

export interface AlertResult {
  saved: boolean;
  smsSent: boolean;
  latitude?: number;
  longitude?: number;
}

async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,
    });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}

async function saveLocalAlert(alert: LocalAlert): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO local_alerts
       (id, mission_id, alert_type, latitude, longitude, message, sms_fallback, created_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
    [
      alert.id,
      alert.mission_id ?? null,
      alert.alert_type,
      alert.latitude ?? null,
      alert.longitude ?? null,
      alert.message ?? null,
      alert.sms_fallback ?? 0,
    ]
  );
}

export async function sendDistressAlert(payload: AlertPayload): Promise<AlertResult> {
  const position = await getCurrentPosition();
  const lat = position?.lat ?? 0;
  const lng = position?.lng ?? 0;

  const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Sauvegarde locale d'abord (offline-first)
  await saveLocalAlert({
    id: alertId,
    mission_id: payload.missionId,
    alert_type: payload.alertType,
    latitude: lat || undefined,
    longitude: lng || undefined,
    message: payload.message,
    sms_fallback: 1,
    is_synced: 0,
  });

  // Tentative envoi SMS
  let smsSent = false;
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      const smsBody = buildAlertMessage(payload.userId, lat, lng, payload.missionId);
      await SMS.sendSMSAsync([PLATFORM_PHONE], smsBody);
      smsSent = true;
    }
  } catch {
    // SMS non disponible ou refusé — l'alerte reste en DB pour sync ultérieur
  }

  return {
    saved: true,
    smsSent,
    latitude: lat || undefined,
    longitude: lng || undefined,
  };
}

export async function getPendingAlerts(): Promise<LocalAlert[]> {
  return db.getAllAsync<LocalAlert>(
    `SELECT * FROM local_alerts WHERE is_synced = 0 ORDER BY created_at DESC`
  );
}

export async function markAlertSynced(id: string): Promise<void> {
  await db.runAsync(`UPDATE local_alerts SET is_synced = 1 WHERE id = ?`, [id]);
}
